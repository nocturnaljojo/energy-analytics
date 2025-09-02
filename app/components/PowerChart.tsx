'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, Area, ComposedChart 
} from 'recharts'
import { format, subHours, subDays } from 'date-fns'
import { Calendar, Clock, RefreshCw, DollarSign, Zap, TrendingUp } from 'lucide-react'

interface PowerChartProps {
  generatorDuid: string
  onDateRangeChange?: (range: string) => void // Added this prop
}

interface ChartData {
  time: string
  fullTime: string
  mw: number | null
  rrp: number | null
  revenue: number | null
}

interface GeneratorInfo {
  duid: string
  station_name: string | null
  region: string | null
  fuel_source: string | null
}

export default function PowerChart({ generatorDuid, onDateRangeChange }: PowerChartProps) {
  const [data, setData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('24h')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [generatorInfo, setGeneratorInfo] = useState<GeneratorInfo | null>(null)
  const [totals, setTotals] = useState({
    totalRevenue: 0,
    avgMW: 0,
    avgRRP: 0,
    dataPoints: 0
  })

  useEffect(() => {
    fetchGeneratorInfo()
    fetchCombinedData()
    
    if (autoRefresh) {
      const interval = setInterval(fetchCombinedData, 60000)
      return () => clearInterval(interval)
    }
  }, [generatorDuid, dateRange, startDate, endDate, autoRefresh])

  // NEW: Handler for date range changes that syncs with parent
  const handleDateRangeChange = (range: string) => {
    console.log('PowerChart: Date range changed to', range)
    setDateRange(range)
    
    // CRITICAL: Call parent callback to sync with RevenueLeaderboard
    if (onDateRangeChange) {
      onDateRangeChange(range)
    }
  }

  const fetchGeneratorInfo = async () => {
    const { data, error } = await supabase
      .from('nem_generators')
      .select('duid, station_name, region, fuel_source_primary')
      .eq('duid', generatorDuid)
      .single()
    
    if (data) {
      setGeneratorInfo({
        duid: data.duid,
        station_name: data.station_name,
        region: data.region,
        fuel_source: data.fuel_source_primary
      })
    }
  }

  const fetchCombinedData = async () => {
    setLoading(true)
    
    // Calculate date range
    let fromDate = new Date()
    let toDate = new Date()
    
    switch(dateRange) {
      case '24h':
        fromDate = subHours(toDate, 24)
        break
      case '7d':
        fromDate = subDays(toDate, 7)
        break
      case '30d':
        fromDate = subDays(toDate, 30)
        break
      case 'custom':
        if (startDate && endDate) {
          fromDate = new Date(startDate)
          toDate = new Date(endDate)
        }
        break
    }
    
    // Fetch revenue data (which includes MW and RRP)
    const { data: revenueData, error: revenueError } = await supabase
      .from('nem_revenue_reporting')
      .select('settlementdate, scada_mw, rrp, revenue_5min, regionid')
      .eq('duid', generatorDuid)
      .gte('settlementdate', fromDate.toISOString())
      .lte('settlementdate', toDate.toISOString())
      .order('settlementdate', { ascending: true })
      .limit(2000)
    
    if (revenueError) {
      console.error('Error fetching revenue data:', revenueError)
      
      // Fallback to separate queries if revenue table isn't populated
      await fetchSeparateData(fromDate, toDate)
      return
    }
    
    if (revenueData && revenueData.length > 0) {
      // Optimize data points
      const maxPoints = 300
      const step = Math.ceil(revenueData.length / maxPoints)
      const optimizedData = revenueData.filter((_, index) => index % step === 0)
      
      const chartData = optimizedData.map(point => ({
        time: format(new Date(point.settlementdate), 
          dateRange === '24h' ? 'HH:mm' : 'MMM dd HH:mm'
        ),
        fullTime: format(new Date(point.settlementdate), 'MMM dd, yyyy HH:mm:ss'),
        mw: point.scada_mw || 0,
        rrp: point.rrp || 0,
        revenue: point.revenue_5min || 0
      }))
      
      // Calculate totals
      const totalRevenue = revenueData.reduce((sum, p) => sum + (p.revenue_5min || 0), 0)
      const avgMW = revenueData.reduce((sum, p) => sum + (p.scada_mw || 0), 0) / revenueData.length
      const avgRRP = revenueData.reduce((sum, p) => sum + (p.rrp || 0), 0) / revenueData.length
      
      setTotals({
        totalRevenue,
        avgMW,
        avgRRP,
        dataPoints: revenueData.length
      })
      
      setData(chartData)
    } else {
      setData([])
    }
    
    setLoading(false)
  }

  const fetchSeparateData = async (fromDate: Date, toDate: Date) => {
    // Fallback method if revenue table isn't populated
    const { data: scadaData } = await supabase
      .from('dispatch_unit_scada')
      .select('SETTLEMENTDATE, SCADAVALUE, DUID')
      .eq('DUID', generatorDuid)
      .gte('SETTLEMENTDATE', fromDate.toISOString())
      .lte('SETTLEMENTDATE', toDate.toISOString())
      .order('SETTLEMENTDATE', { ascending: true })
      .limit(2000)
    
    if (scadaData && generatorInfo?.region) {
      // Fetch corresponding price data
      const { data: priceData } = await supabase
        .from('dispatch_prices')
        .select('settlementdate, pre_ap_energy_price')
        .eq('regionid', generatorInfo.region)
        .gte('settlementdate', fromDate.toISOString())
        .lte('settlementdate', toDate.toISOString())
        .order('settlementdate', { ascending: true })
      
      // Create a price map for quick lookup
      const priceMap = new Map(
        priceData?.map(p => [
          new Date(p.settlementdate).getTime(), 
          p.pre_ap_energy_price
        ]) || []
      )
      
      // Combine data
      const maxPoints = 300
      const step = Math.ceil(scadaData.length / maxPoints)
      const optimizedData = scadaData.filter((_, index) => index % step === 0)
      
      const chartData = optimizedData.map(point => {
        const timestamp = new Date(point.SETTLEMENTDATE).getTime()
        const rrp = priceMap.get(timestamp) || 0
        const mw = point.SCADAVALUE || 0
        const revenue = (mw * rrp) / 12 // 5-minute revenue
        
        return {
          time: format(new Date(point.SETTLEMENTDATE), 
            dateRange === '24h' ? 'HH:mm' : 'MMM dd HH:mm'
          ),
          fullTime: format(new Date(point.SETTLEMENTDATE), 'MMM dd, yyyy HH:mm:ss'),
          mw,
          rrp,
          revenue
        }
      })
      
      setData(chartData)
    }
    
    setLoading(false)
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
          <p className="text-gray-300 text-sm mb-2">{data.fullTime}</p>
          <div className="space-y-1">
            <p className="text-green-400 text-sm">
              MW: {data.mw?.toFixed(2) || '0.00'} MW
            </p>
            <p className="text-blue-400 text-sm">
              RRP: ${data.rrp?.toFixed(2) || '0.00'}/MWh
            </p>
            <p className="text-yellow-400 text-sm">
              Revenue: ${data.revenue?.toFixed(2) || '0.00'}
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            {generatorInfo?.station_name || generatorDuid}
          </h2>
          <div className="flex gap-4 mt-1">
            <span className="text-sm text-gray-400">DUID: {generatorDuid}</span>
            {generatorInfo?.region && (
              <span className="text-sm text-gray-400">Region: {generatorInfo.region}</span>
            )}
            {generatorInfo?.fuel_source && (
              <span className="text-sm text-gray-400">Fuel: {generatorInfo.fuel_source}</span>
            )}
          </div>
        </div>
        
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`flex items-center space-x-2 px-3 py-1 rounded-lg transition-colors ${
            autoRefresh 
              ? 'bg-green-600 text-white' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
          <span className="text-sm">Auto Refresh</span>
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <DollarSign className="w-4 h-4" />
            Total Revenue
          </div>
          <div className="text-2xl font-bold text-yellow-400">
            ${totals.totalRevenue.toFixed(0)}
          </div>
          <div className="text-xs text-gray-500">5-min intervals</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Zap className="w-4 h-4" />
            Avg Output
          </div>
          <div className="text-2xl font-bold text-green-400">
            {totals.avgMW.toFixed(1)} MW
          </div>
          <div className="text-xs text-gray-500">Period average</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <TrendingUp className="w-4 h-4" />
            Avg RRP
          </div>
          <div className="text-2xl font-bold text-blue-400">
            ${totals.avgRRP.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">$/MWh</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Clock className="w-4 h-4" />
            Data Points
          </div>
          <div className="text-2xl font-bold text-gray-400">
            {totals.dataPoints}
          </div>
          <div className="text-xs text-gray-500">Intervals</div>
        </div>
      </div>
      
      {/* Date Range Selector - UPDATED to use handleDateRangeChange */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleDateRangeChange('24h')} // FIXED: Now calls handleDateRangeChange
          className={`px-4 py-2 rounded-lg transition-colors ${
            dateRange === '24h' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          24 Hours
        </button>
        <button
          onClick={() => handleDateRangeChange('7d')} // FIXED: Now calls handleDateRangeChange
          className={`px-4 py-2 rounded-lg transition-colors ${
            dateRange === '7d' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          7 Days
        </button>
        <button
          onClick={() => handleDateRangeChange('30d')} // FIXED: Now calls handleDateRangeChange
          className={`px-4 py-2 rounded-lg transition-colors ${
            dateRange === '30d' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          30 Days
        </button>
      </div>
      
      {/* Chart */}
      <div className="bg-gray-950 rounded p-4">
        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="animate-pulse text-gray-400">Loading data...</div>
          </div>
        ) : data.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="time" 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              
              {/* Left Y-Axis for MW */}
              <YAxis 
                yAxisId="mw"
                stroke="#10B981"
                tick={{ fill: '#10B981' }}
                label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#10B981' }}
              />
              
              {/* Right Y-Axis for RRP */}
              <YAxis 
                yAxisId="rrp"
                orientation="right"
                stroke="#3B82F6"
                tick={{ fill: '#3B82F6' }}
                label={{ value: '$/MWh', angle: 90, position: 'insideRight', fill: '#3B82F6' }}
              />
              
              <Tooltip content={<CustomTooltip />} />
              
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
              
              {/* Revenue as area */}
              <Area
                yAxisId="rrp"
                type="monotone"
                dataKey="revenue"
                fill="#FCD34D"
                fillOpacity={0.3}
                stroke="#FCD34D"
                strokeWidth={1}
                name="Revenue ($)"
              />
              
              {/* Power Output line */}
              <Line 
                yAxisId="mw"
                type="monotone" 
                dataKey="mw" 
                stroke="#10B981" 
                strokeWidth={2}
                name="Power (MW)"
                dot={false}
                activeDot={{ r: 6 }}
              />
              
              {/* RRP line */}
              <Line
                yAxisId="rrp"
                type="monotone"
                dataKey="rrp"
                stroke="#3B82F6"
                strokeWidth={2}
                name="RRP ($/MWh)"
                dot={false}
                strokeDasharray="5 5"
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-96 flex items-center justify-center text-gray-500">
            No data available for selected period
          </div>
        )}
      </div>
      
      <div className="flex justify-between text-sm text-gray-400">
        <span>Showing {data.length} data points</span>
        <span>Last updated: {format(new Date(), 'HH:mm:ss')}</span>
      </div>
    </div>
  )
}