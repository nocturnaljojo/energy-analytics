'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Generator {
  DUID: string
  SCADAVALUE: number
  SETTLEMENTDATE: string
}

interface GeneratorListProps {
  onSelectGenerator: (duid: string) => void
}

export default function GeneratorList({ onSelectGenerator }: GeneratorListProps) {
  const [generators, setGenerators] = useState<Generator[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchGenerators()
  }, [])

  const fetchGenerators = async () => {
    console.log('Fetching generators...')
    
    // Using uppercase column names
    const { data, error } = await supabase
      .from('dispatch_unit_scada')
      .select('DUID, SCADAVALUE, SETTLEMENTDATE')
      .order('SETTLEMENTDATE', { ascending: false })
      .limit(200)
    
    if (error) {
      console.error('Error fetching generators:', error)
      setLoading(false)
      return
    }
    
    console.log('Raw data received:', data?.length, 'records')
    
    if (data && data.length > 0) {
      // Get unique generators with their latest values
      const uniqueGenerators = data.reduce((acc: Generator[], curr) => {
        if (!acc.find(g => g.DUID === curr.DUID)) {
          acc.push(curr)
        }
        return acc
      }, [])
      
      console.log('Unique generators found:', uniqueGenerators.length)
      setGenerators(uniqueGenerators)
    }
    
    setLoading(false)
  }

  if (loading) return <div className="p-4 text-yellow-400">Loading generators...</div>

  return (
    <div className="h-full overflow-y-auto bg-gray-900 text-white">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold">Generators</h2>
        <p className="text-sm text-gray-400">{generators.length} units</p>
      </div>
      
      {generators.length === 0 ? (
        <div className="p-4 text-yellow-400">
          No generators found. Check console for details.
        </div>
      ) : (
        <div className="divide-y divide-gray-800">
          {generators.map((gen) => (
            <div
              key={gen.DUID}
              onClick={() => onSelectGenerator(gen.DUID)}
              className="p-3 hover:bg-gray-800 cursor-pointer transition-colors"
            >
              <div className="font-medium">{gen.DUID}</div>
              <div className="text-sm text-gray-400">
                {gen.SCADAVALUE ? `${gen.SCADAVALUE.toFixed(1)} MW` : 'No data'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}