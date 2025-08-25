'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format, subHours, subDays } from 'date-fns'
import { Calendar, Clock, RefreshCw } from 'lucide-react'

interface PowerChartProps {
  generatorDuid: string
}

interface ChartData {
  time: string
  value: number
  fullTime: string
}

export default function PowerChart({ generatorDuid }: PowerChartProps) {
  const [data, setData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('24h') // 24h, 7d, 30d, custom
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)

  useEffect(() => {
    fetchGeneratorData()
    
    // Auto-refresh every 60 seconds if enabled
    if (autoRefresh) {
      const interval = setInterval(fetchGeneratorData, 60000)
      return () => clearInterval(interval)
    }
  }, [generatorDuid, dateRange, startDate, endDate, autoRefresh])

  const fetchGeneratorData = async () => {
    setLoading(true)
    console.log('Fetching data for:', generatorDuid)
    
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
    
    const { data: scadaData, error } = await supabase
      .from('dispatch_unit_scada')
      .select('SETTLEMENTDATE, SCADAVALUE')
      .eq('DUID', generatorDuid)
      .gte('SETTLEMENTDATE', fromDate.toISOString())
      .lte('SETTLEMENTDATE', toDate.toISOString())
      .order('SETTLEMENTDATE', { ascending: true })
      .limit(2000) // More data for longer periods
    
    if (error) {
      console.error('Error fetching chart data:', error)
      setLoading(false)
      return
    }
    
    if (scadaData && scadaData.length > 0) {
      // Optimize data points for performance
      const maxPoints = 300
      const step = Math.ceil(scadaData.length / maxPoints)
      const optimizedData = scadaData.filter((_, index) => index % step === 0)
      
      const chartData = optimizedData.map(point => ({
        time: format(new Date(point.SETTLEMENTDATE), 
          dateRange === '24h' ? 'HH:mm' : 'MMM dd HH:mm'
        ),
        fullTime: format(new Date(point.SETTLEMENTDATE), 'MMM dd, yyyy HH:mm:ss'),
        value: point.SCADAVALUE || 0
      }))
      
      console.log('Chart data prepared:', chartData.length, 'points')
      setData(chartData)
    } else {
      setData([])
    }
    
    setLoading(false)
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">
          {generatorDuid} - Power Output
        </h2>
        
        {/* Auto Refresh Toggle */}
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
      
      {/* Date Range Selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setDateRange('24h')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            dateRange === '24h' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <Clock className="w-4 h-4 inline mr-1" />
          24 Hours
        </button>
        <button
          onClick={() => setDateRange('7d')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            dateRange === '7d' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-1" />
          7 Days
        </button>
        <button
          onClick={() => setDateRange('30d')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            dateRange === '30d' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-1" />
          30 Days
        </button>
        
        {/* Custom Date Range */}
        <div className="flex items-center space-x-2">
          <input
            type="datetime-local"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
              setDateRange('custom')
            }}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          />
          <span className="text-gray-400">to</span>
          <input
            type="datetime-local"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value)
              setDateRange('custom')
            }}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          />
        </div>
      </div>
      
      {/* Chart */}
      <div className="bg-gray-950 rounded p-4">
        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="animate-pulse text-gray-400">Loading chart data...</div>
          </div>
        ) : data.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="time" 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
                label={{ value: 'MW', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: '#E5E7EB' }}
                formatter={(value: number) => [`${value.toFixed(2)} MW`, 'Output']}
                labelFormatter={(label) => {
                  const point = data.find(d => d.time === label)
                  return point ? point.fullTime : label
                }}
              />
              <Legend 
                wrapperStyle={{ color: '#E5E7EB' }}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#10B981" 
                strokeWidth={2}
                name="Power Output (MW)"
                dot={false}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-96 flex items-center justify-center text-gray-500">
            No data available for selected period
          </div>
        )}
      </div>
      
      <div className="mt-4 flex justify-between text-sm text-gray-400">
        <span>Showing {data.length} data points</span>
        <span>Last updated: {format(new Date(), 'HH:mm:ss')}</span>
      </div>
    </div>
  )
}