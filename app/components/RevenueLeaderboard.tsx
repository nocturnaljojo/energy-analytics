'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TrendingUp, Award, DollarSign, Zap, Wind, Sun, Battery, Flame, Droplets, Crown } from 'lucide-react'

interface RevenueData {
  duid: string
  station_name: string | null
  participant: string | null
  region: string
  fuel_source: string | null
  total_revenue: number
  avg_mw: number
  total_mwh: number
  data_points: number
}

interface RevenueLeaderboardProps {
  selectedRegions: string[]
  selectedFuelTypes: string[]
  dateRange: string
}

export default function RevenueLeaderboard({ 
  selectedRegions, 
  selectedFuelTypes, 
  dateRange 
}: RevenueLeaderboardProps) {
  const [revenueData, setRevenueData] = useState<RevenueData[]>([])
  const [loading, setLoading] = useState(true)
  const [totalMarketRevenue, setTotalMarketRevenue] = useState(0)

  useEffect(() => {
    fetchRevenueData()
  }, [selectedRegions, selectedFuelTypes, dateRange])

  const fetchRevenueData = async () => {
    setLoading(true)
    
    // Calculate date range
    let hours = 24
    switch(dateRange) {
      case '24h': hours = 24; break
      case '7d': hours = 168; break
      case '30d': hours = 720; break
    }
    
    const fromDate = new Date()
    fromDate.setHours(fromDate.getHours() - hours)
    
    // Build query
    let query = supabase
      .from('nem_revenue_reporting')
      .select(`
        duid,
        revenue_5min,
        scada_mw,
        regionid,
        settlementdate
      `)
      .gte('settlementdate', fromDate.toISOString())
    
    // Apply region filter
    if (selectedRegions.length > 0) {
      query = query.in('regionid', selectedRegions)
    }
    
    const { data: revenueRecords, error } = await query
    
    if (error) {
      console.error('Error fetching revenue data:', error)
      setLoading(false)
      return
    }
    
    // Fetch generator metadata
    const { data: generators } = await supabase
      .from('nem_generators')
      .select('duid, station_name, participant, region, fuel_source_primary')
    
    // Create generator map
    const genMap = new Map()
    generators?.forEach(gen => {
      genMap.set(gen.duid, gen)
    })
    
    // Aggregate revenue by DUID
    const revenueMap = new Map<string, any>()
    
    revenueRecords?.forEach(record => {
      const gen = genMap.get(record.duid)
      
      // Apply fuel type filter
      if (selectedFuelTypes.length > 0 && 
          (!gen || !selectedFuelTypes.includes(gen.fuel_source_primary))) {
        return
      }
      
      if (!revenueMap.has(record.duid)) {
        revenueMap.set(record.duid, {
          duid: record.duid,
          station_name: gen?.station_name || null,
          participant: gen?.participant || null,
          region: record.regionid,
          fuel_source: gen?.fuel_source_primary || null,
          total_revenue: 0,
          total_mwh: 0,
          data_points: 0
        })
      }
      
      const entry = revenueMap.get(record.duid)
      entry.total_revenue += (record.revenue_5min || 0)
      entry.total_mwh += ((record.scada_mw || 0) / 12) // 5-min intervals
      entry.data_points += 1
    })
    
    // Convert to array and calculate averages
    const revenueArray = Array.from(revenueMap.values()).map(entry => ({
      ...entry,
      avg_mw: entry.total_mwh > 0 ? entry.total_mwh * 12 / entry.data_points : 0
    }))
    
    // Sort by total revenue descending
    revenueArray.sort((a, b) => b.total_revenue - a.total_revenue)
    
    // Calculate total market revenue
    const total = revenueArray.reduce((sum, item) => sum + item.total_revenue, 0)
    setTotalMarketRevenue(total)
    
    // Take top 10
    setRevenueData(revenueArray.slice(0, 10))
    setLoading(false)
  }

  const getFuelIcon = (fuelType: string | null) => {
    if (!fuelType) return <Zap className="w-4 h-4 text-gray-400" />
    
    const fuel = fuelType.toLowerCase()
    if (fuel.includes('wind')) return <Wind className="w-4 h-4 text-blue-400" />
    if (fuel.includes('solar')) return <Sun className="w-4 h-4 text-yellow-400" />
    if (fuel.includes('battery')) return <Battery className="w-4 h-4 text-green-400" />
    if (fuel.includes('hydro')) return <Droplets className="w-4 h-4 text-cyan-400" />
    if (fuel.includes('gas')) return <Flame className="w-4 h-4 text-orange-400" />
    return <Zap className="w-4 h-4 text-gray-400" />
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />
    if (rank === 2) return <Award className="w-5 h-5 text-gray-300" />
    if (rank === 3) return <Award className="w-5 h-5 text-orange-600" />
    return <span className="w-5 h-5 text-center text-gray-500 text-sm font-bold">{rank}</span>
  }

  const formatRevenue = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`
    return `$${value.toFixed(0)}`
  }

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-800 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-16 bg-gray-800 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-bold text-white">Revenue Leaders</h3>
        </div>
        <div className="text-sm text-gray-400">
          Total: {formatRevenue(totalMarketRevenue)}
        </div>
      </div>

      {/* Leaderboard */}
      {revenueData.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          No revenue data available for selected filters
        </div>
      ) : (
        <div className="space-y-2">
          {revenueData.map((item, index) => {
            const rank = index + 1
            const revenuePercent = (item.total_revenue / totalMarketRevenue * 100).toFixed(1)
            
            return (
              <div
                key={item.duid}
                className={`relative p-3 rounded-lg transition-all hover:scale-[1.02] ${
                  rank === 1 ? 'bg-gradient-to-r from-yellow-900/30 to-gray-800 border border-yellow-600/30' :
                  rank === 2 ? 'bg-gradient-to-r from-gray-700/50 to-gray-800' :
                  rank === 3 ? 'bg-gradient-to-r from-orange-900/20 to-gray-800' :
                  'bg-gray-800 hover:bg-gray-750'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <div className="flex items-center justify-center w-8">
                    {getRankIcon(rank)}
                  </div>
                  
                  {/* Generator Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {getFuelIcon(item.fuel_source)}
                      <span className="font-medium text-white truncate">
                        {item.station_name || item.duid}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 bg-gray-700 rounded text-gray-400">
                        {item.region}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                      {item.participant || 'Unknown Participant'} • {item.duid}
                    </div>
                  </div>
                  
                  {/* Revenue Stats */}
                  <div className="text-right">
                    <div className="text-lg font-bold text-yellow-400">
                      {formatRevenue(item.total_revenue)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {revenuePercent}% • {item.avg_mw.toFixed(1)} MW avg
                    </div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${
                      rank === 1 ? 'bg-yellow-400' :
                      rank === 2 ? 'bg-gray-400' :
                      rank === 3 ? 'bg-orange-500' :
                      'bg-blue-500'
                    }`}
                    style={{ width: `${revenuePercent}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}