'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'

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

  useEffect(() => {
    fetchGeneratorData()
  }, [generatorDuid])

  const fetchGeneratorData = async () => {
    setLoading(true)
    console.log('Fetching data for:', generatorDuid)
    
    const { data: scadaData, error } = await supabase
      .from('dispatch_unit_scada')
      .select('SETTLEMENTDATE, SCADAVALUE')
      .eq('DUID', generatorDuid)
      .order('SETTLEMENTDATE', { ascending: false })
      .limit(288) // 24 hours of 5-minute data
    
    if (error) {
      console.error('Error fetching chart data:', error)
      setLoading(false)
      return
    }
    
    if (scadaData && scadaData.length > 0) {
      // Format data for the chart
      const chartData = scadaData.reverse().map(point => ({
        time: format(new Date(point.SETTLEMENTDATE), 'HH:mm'),
        fullTime: format(new Date(point.SETTLEMENTDATE), 'MMM dd, yyyy HH:mm:ss'),
        value: point.SCADAVALUE || 0
      }))
      
      console.log('Chart data prepared:', chartData.length, 'points')
      setData(chartData)
    }
    
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 text-white">
        <div className="animate-pulse">Loading chart data...</div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-4">
        {generatorDuid} - Power Output
      </h2>
      
      <div className="bg-gray-950 rounded p-4">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="time" 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF' }}
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
          <div className="text-gray-500 text-center py-8">
            No data available for this generator
          </div>
        )}
      </div>
      
      <div className="mt-4 text-sm text-gray-400">
        Showing {data.length} data points • 5-minute intervals
      </div>
    </div>
  )
}