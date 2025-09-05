'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { subHours, subDays } from 'date-fns'
import { TrendingUp, Award, DollarSign, Zap, Wind, Sun, Battery, Flame, Droplets, Crown, BarChart3, Target } from 'lucide-react'

interface PerformanceData {
  duid: string
  station_name: string | null
  participant: string | null
  region: string
  fuel_source: string | null
  max_capacity: number
  total_revenue: number
  avg_mw: number
  total_mwh: number
  data_points: number
  capacity_factor: number
  utilization_rate: number
  revenue_intensity: number
  max_possible_mwh: number
  performance_score: number
}

interface PerformanceLeaderboardProps {
  selectedRegions: string[]
  selectedFuelTypes: string[]
  dateRange: string
}

export default function PerformanceLeaderboard({ 
  selectedRegions, 
  selectedFuelTypes, 
  dateRange 
}: PerformanceLeaderboardProps) {
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'revenue' | 'capacity_factor' | 'revenue_intensity' | 'performance_score'>('performance_score')
  const [hoveredItem, setHoveredItem] = useState<PerformanceData | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchPerformanceData()
  }, [selectedRegions, selectedFuelTypes, dateRange])

  useEffect(() => {
    if (performanceData.length > 0) {
      sortPerformanceData()
    }
  }, [sortBy])

  const sortPerformanceData = () => {
    const sortedData = [...performanceData].sort((a, b) => {
      switch(sortBy) {
        case 'revenue': return b.total_revenue - a.total_revenue
        case 'capacity_factor': return b.capacity_factor - a.capacity_factor
        case 'revenue_intensity': return b.revenue_intensity - a.revenue_intensity
        case 'performance_score': return b.performance_score - a.performance_score
        default: return b.performance_score - a.performance_score
      }
    })
    setPerformanceData(sortedData)
  }

  const handleMouseEnter = (item: PerformanceData, event: React.MouseEvent) => {
    const timeout = setTimeout(() => {
      setHoveredItem(item)
      setTooltipPosition({ x: event.clientX, y: event.clientY })
    }, 2000)
    setHoverTimeout(timeout)
  }

  const handleMouseLeave = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      setHoverTimeout(null)
    }
    setHoveredItem(null)
  }

  const handleMouseMove = (event: React.MouseEvent) => {
    if (hoveredItem) {
      setTooltipPosition({ x: event.clientX, y: event.clientY })
    }
  }

  useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout)
      }
    }
  }, [hoverTimeout])

  const fetchPerformanceData = async () => {
    setLoading(true)
    setError(null)
    console.log('Fetching performance data with filters:', { selectedRegions, selectedFuelTypes, dateRange })

    try {
      // Use IDENTICAL date calculation logic as PowerChart
      let fromDate = new Date()
      let toDate = new Date()
      let hours = 0
      
      switch(dateRange) {
        case '24h':
          fromDate = subHours(toDate, 24)
          hours = 24
          break
        case '7d':
          fromDate = subDays(toDate, 7)
          hours = 24 * 7
          break
        case '30d':
          fromDate = subDays(toDate, 30)
          hours = 24 * 30
          break
        default:
          fromDate = subHours(toDate, 24)
          hours = 24
          break
      }

      console.log('Performance Date range:', fromDate.toISOString(), 'to', toDate.toISOString())

      // Get renewable generator data
      const { data: renewableGens, error: renewableError } = await supabase
        .from('nem_renewable_generators')
        .select('duid, fuel_source_primary, reg_cap_generation, max_cap_generation')

      if (renewableError) {
        console.error('Error fetching renewable generators:', renewableError)
        setError('Failed to fetch renewable generator data')
        setLoading(false)
        return
      }

      // Get main generator metadata
      const { data: mainGens, error: mainGenError } = await supabase
        .from('nem_generators')
        .select('duid, station_name, participant, region')

      if (mainGenError) {
        console.error('Error fetching main generators:', mainGenError)
        setError('Failed to fetch generator metadata')
        setLoading(false)
        return
      }

      const mainGenMap = new Map()
      mainGens?.forEach(gen => {
        mainGenMap.set(gen.duid, gen)
      })

      const generators = renewableGens?.map(renewableGen => {
        const mainGen = mainGenMap.get(renewableGen.duid)
        return {
          duid: renewableGen.duid,
          station_name: mainGen?.station_name || null,
          participant: mainGen?.participant || null,
          region: mainGen?.region || null,
          fuel_source_primary: renewableGen.fuel_source_primary,
          max_cap_generation: renewableGen.max_cap_generation,
          reg_cap_generation: renewableGen.reg_cap_generation
        }
      }).filter(gen => gen.max_cap_generation && gen.max_cap_generation > 0)

      const genMap = new Map()
      generators?.forEach(gen => {
        genMap.set(gen.duid, {
          ...gen,
          region: gen.region || '',
          fuel_source_primary: gen.fuel_source_primary || ''
        })
      })

      const allRenewableDuids = Array.from(genMap.keys())
      
      // Use IDENTICAL query structure as PowerChart
      const { data: revenueRecords, error: revenueError } = await supabase
        .from('nem_revenue_reporting')
        .select('duid, revenue_5min, scada_mw, regionid, settlementdate')
        .gte('settlementdate', fromDate.toISOString())
        .lte('settlementdate', toDate.toISOString())  // Add upper bound like PowerChart
        .in('duid', allRenewableDuids)
        .order('settlementdate', { ascending: true })
        .limit(2000) // Add same limit as PowerChart

      if (revenueError) {
        console.error('Error fetching revenue data:', revenueError)
        setError('Failed to fetch revenue data')
        setLoading(false)
        return
      }

      console.log('Performance Revenue records fetched:', revenueRecords?.length)

      if (!revenueRecords || revenueRecords.length === 0) {
        console.log('No revenue data found for the selected period')
        setPerformanceData([])
        setLoading(false)
        return
      }

      const performanceMap = new Map<string, any>()

      // Use IDENTICAL aggregation logic as PowerChart
      revenueRecords.forEach(record => {
        const gen = genMap.get(record.duid)
        
        if (!gen) return

        if (!performanceMap.has(record.duid)) {
          performanceMap.set(record.duid, {
            duid: record.duid,
            station_name: gen.station_name,
            participant: gen.participant,
            region: gen.region,
            fuel_source: gen.fuel_source_primary,
            max_capacity: gen.max_cap_generation,
            total_revenue: 0,
            total_mwh: 0,
            data_points: 0,
            scada_sum: 0
          })
        }

        const entry = performanceMap.get(record.duid)
        // CRITICAL: Use identical revenue aggregation as PowerChart
        entry.total_revenue += (record.revenue_5min || 0)
        entry.scada_sum += (record.scada_mw || 0)
        entry.data_points += 1
        entry.total_mwh += ((record.scada_mw || 0) / 12)
      })

      console.log('Aggregated performance data for', performanceMap.size, 'generators')

      const allPerformance = Array.from(performanceMap.values()).map(entry => {
        const maxPossibleMwh = entry.max_capacity * hours
        const capacityFactor = maxPossibleMwh > 0 ? (entry.total_mwh / maxPossibleMwh) * 100 : 0
        const revenueIntensity = entry.total_revenue / entry.max_capacity
        const avgMw = entry.data_points > 0 ? entry.scada_sum / entry.data_points : 0
        const utilizationRate = entry.max_capacity > 0 ? (avgMw / entry.max_capacity) * 100 : 0
        const normalizedCapacityFactor = Math.min(capacityFactor, 100)
        const performanceScore = (normalizedCapacityFactor * 0.6) + ((revenueIntensity / 1000) * 0.4)

        return {
          ...entry,
          avg_mw: avgMw,
          capacity_factor: capacityFactor,
          utilization_rate: utilizationRate,
          revenue_intensity: revenueIntensity,
          max_possible_mwh: maxPossibleMwh,
          performance_score: performanceScore
        } as PerformanceData
      }).filter(entry => entry.total_revenue > 0 && entry.max_capacity > 0)

      // Debug: Log Bango generators specifically for comparison
      const bangowf1Data = allPerformance.find(item => item.duid === 'BANGOWF1')
      const bangowf2Data = allPerformance.find(item => item.duid === 'BANGOWF2')
      
      console.log('=== REVENUE CONSISTENCY DEBUG ===')
      console.log('Date Range:', dateRange, '| From:', fromDate.toISOString(), '| To:', toDate.toISOString())
      console.log('Total revenue records processed:', revenueRecords?.length)
      
      if (bangowf1Data) {
        console.log('BANGOWF1 (Bango 973):', {
          total_revenue: bangowf1Data.total_revenue.toFixed(2),
          data_points: bangowf1Data.data_points,
          avg_revenue_per_interval: (bangowf1Data.total_revenue / bangowf1Data.data_points).toFixed(2),
          station_name: bangowf1Data.station_name
        })
      }
      
      if (bangowf2Data) {
        console.log('BANGOWF2 (Bango 999):', {
          total_revenue: bangowf2Data.total_revenue.toFixed(2),
          data_points: bangowf2Data.data_points, 
          avg_revenue_per_interval: (bangowf2Data.total_revenue / bangowf2Data.data_points).toFixed(2),
          station_name: bangowf2Data.station_name
        })
      }
      
      console.log('Total generators with revenue data:', allPerformance.length)
      console.log('=== END DEBUG ===')

      const filteredData = allPerformance.filter(entry => {
        let includeRegion = selectedRegions.length === 0 || selectedRegions.includes(entry.region || '')
        let includeFuel = selectedFuelTypes.length === 0 || selectedFuelTypes.includes(entry.fuel_source || '')
        return includeRegion && includeFuel
      })

      console.log('Filtered performance data:', filteredData.length, 'of', allPerformance.length, 'generators')

      setPerformanceData(filteredData.slice(0, 15))
      
    } catch (err) {
      console.error('Unexpected error in fetchPerformanceData:', err)
      setError('An unexpected error occurred')
    }
    
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
    if (fuel.includes('coal')) return <Zap className="w-4 h-4 text-gray-600" />
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

  const getCapacityFactorColor = (cf: number) => {
    if (cf >= 80) return 'text-green-400'
    if (cf >= 60) return 'text-yellow-400'
    if (cf >= 40) return 'text-orange-400'
    return 'text-red-400'
  }

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-800 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-20 bg-gray-800 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-lg p-6">
        <div className="text-red-400 text-center">
          <p className="mb-2">Error loading performance data</p>
          <p className="text-sm text-gray-500">{error}</p>
          <button onClick={fetchPerformanceData} className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 relative">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-bold text-white">Performance Leaders</h3>
          <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">
            {dateRange}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setSortBy('performance_score')}
          className={`px-3 py-1.5 rounded text-xs transition-colors ${
            sortBy === 'performance_score' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Performance Score
        </button>
        <button
          onClick={() => setSortBy('capacity_factor')}
          className={`px-3 py-1.5 rounded text-xs transition-colors ${
            sortBy === 'capacity_factor' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Capacity Factor
        </button>
        <button
          onClick={() => setSortBy('revenue_intensity')}
          className={`px-3 py-1.5 rounded text-xs transition-colors ${
            sortBy === 'revenue_intensity' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Revenue/MW
        </button>
        <button
          onClick={() => setSortBy('revenue')}
          className={`px-3 py-1.5 rounded text-xs transition-colors ${
            sortBy === 'revenue' ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Total Revenue
        </button>
      </div>

      <div className="text-xs text-gray-500 mb-4 bg-gray-800 p-2 rounded">
        <span className="font-medium">CF:</span> Energy generated vs theoretical max over period • 
        <span className="font-medium"> Utilization:</span> Average capacity used when generating • 
        <span className="font-medium"> Revenue/MW:</span> Revenue efficiency per MW capacity
      </div>

      {performanceData.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <p>No performance data available</p>
          <p className="text-sm mt-1">No generators with capacity data match your filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {performanceData.map((item, index) => {
            const rank = index + 1

            return (
              <div
                key={item.duid}
                className={`relative p-4 rounded-lg transition-all hover:scale-[1.01] cursor-pointer ${
                  rank === 1 ? 'bg-gradient-to-r from-yellow-900/30 to-gray-800 border border-yellow-600/30' :
                  rank === 2 ? 'bg-gradient-to-r from-gray-700/50 to-gray-800' :
                  rank === 3 ? 'bg-gradient-to-r from-orange-900/20 to-gray-800' :
                  'bg-gray-800 hover:bg-gray-750'
                }`}
                onMouseEnter={(e) => handleMouseEnter(item, e)}
                onMouseLeave={handleMouseLeave}
                onMouseMove={handleMouseMove}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8">
                    {getRankIcon(rank)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {getFuelIcon(item.fuel_source)}
                      <span className="font-medium text-white truncate">
                        {item.station_name || item.duid}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 bg-gray-700 rounded text-gray-400">
                        {item.region}
                      </span>
                      <span className="text-xs text-gray-500">
                        {item.max_capacity.toFixed(0)} MW
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                      {item.participant || 'Unknown'} • {item.duid}
                    </div>
                  </div>

                  <div className="text-right min-w-[140px]">
                    <div className="flex flex-col gap-0.5">
                      <div className={`text-sm font-bold ${getCapacityFactorColor(item.capacity_factor)}`}>
                        {item.capacity_factor.toFixed(1)}% CF
                      </div>
                      <div className={`text-xs ${getCapacityFactorColor(item.utilization_rate)}`}>
                        {item.utilization_rate.toFixed(1)}% Utilization
                      </div>
                      <div className="text-xs text-gray-400">
                        {formatRevenue(item.revenue_intensity)}/MW
                      </div>
                    </div>
                  </div>

                  <div className="text-right min-w-[80px]">
                    <div className="text-lg font-bold text-yellow-400">
                      {formatRevenue(item.total_revenue)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {item.avg_mw.toFixed(0)} MW avg
                    </div>
                  </div>
                </div>

                <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${
                      sortBy === 'capacity_factor' ? 'bg-green-400' :
                      sortBy === 'revenue_intensity' ? 'bg-blue-400' :
                      sortBy === 'performance_score' ? 'bg-purple-400' :
                      'bg-yellow-400'
                    }`}
                    style={{ 
                      width: sortBy === 'capacity_factor' ? `${Math.min(100, item.capacity_factor)}%` :
                             sortBy === 'revenue_intensity' ? `${Math.min(100, (item.revenue_intensity / 2000) * 100)}%` :
                             sortBy === 'performance_score' ? `${Math.min(100, item.performance_score)}%` :
                             `${Math.min(100, (item.total_revenue / Math.max(...performanceData.map(d => d.total_revenue))) * 100)}%`
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {hoveredItem && (
        <div
          className="fixed z-50 pointer-events-none transition-opacity duration-300 ease-out"
          style={{
            left: `${tooltipPosition.x + 15}px`,
            top: `${tooltipPosition.y - 10}px`,
            transform: tooltipPosition.x > window.innerWidth - 300 ? 'translateX(-100%)' : 'translateX(0)',
          }}
        >
          <div className="bg-gray-800/95 backdrop-blur-md border border-gray-600/50 rounded-xl p-4 shadow-2xl max-w-[280px] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 mb-3 border-b border-gray-600/30 pb-2">
              {getFuelIcon(hoveredItem.fuel_source)}
              <div>
                <div className="font-semibold text-white text-sm">
                  {hoveredItem.station_name || hoveredItem.duid}
                </div>
                <div className="text-xs text-gray-400">
                  {hoveredItem.participant || 'Unknown Participant'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="text-center">
                <div className={`text-lg font-bold ${getCapacityFactorColor(hoveredItem.capacity_factor)}`}>
                  {hoveredItem.capacity_factor.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-400">Capacity Factor</div>
              </div>
              <div className="text-center">
                <div className={`text-lg font-bold ${getCapacityFactorColor(hoveredItem.utilization_rate)}`}>
                  {hoveredItem.utilization_rate.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-400">Utilization Rate</div>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Revenue:</span>
                <span className="text-yellow-400 font-semibold">{formatRevenue(hoveredItem.total_revenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Revenue/MW:</span>
                <span className="text-blue-400 font-semibold">{formatRevenue(hoveredItem.revenue_intensity)}/MW</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Max Capacity:</span>
                <span className="text-white font-semibold">{hoveredItem.max_capacity.toFixed(0)} MW</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Avg Output:</span>
                <span className="text-green-400 font-semibold">{hoveredItem.avg_mw.toFixed(1)} MW</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Region:</span>
                <span className="text-white font-semibold">{hoveredItem.region}</span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-gray-600/30">
              <div className="text-center">
                <div className="text-purple-400 font-bold">
                  {hoveredItem.performance_score.toFixed(1)} Performance Score
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
