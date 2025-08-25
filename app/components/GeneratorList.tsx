'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, Zap, Wind, Sun, Battery } from 'lucide-react'

interface Generator {
  DUID: string
  SCADAVALUE: number
  SETTLEMENTDATE: string
}

interface GeneratorListProps {
  onSelectGenerator: (duid: string) => void
  selectedGenerator: string | null
}

export default function GeneratorList({ onSelectGenerator, selectedGenerator }: GeneratorListProps) {
  const [generators, setGenerators] = useState<Generator[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchGenerators()
  }, [])

  const fetchGenerators = async () => {
    console.log('Fetching generators...')
    
    const { data, error } = await supabase
      .from('dispatch_unit_scada')
      .select('DUID, SCADAVALUE, SETTLEMENTDATE')
      .order('SETTLEMENTDATE', { ascending: false })
      .limit(500) // Get more for better search
    
    if (error) {
      console.error('Error fetching generators:', error)
      setLoading(false)
      return
    }
    
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

  // Fast client-side filtering with useMemo for performance
  const filteredGenerators = useMemo(() => {
    if (!searchTerm) return generators
    
    const search = searchTerm.toLowerCase()
    return generators.filter(gen => 
      gen.DUID.toLowerCase().includes(search)
    )
  }, [generators, searchTerm])

  // Get fuel type icon
  const getFuelIcon = (duid: string) => {
    const upper = duid.toUpperCase()
    if (upper.includes('WF') || upper.includes('WIND')) return <Wind className="w-4 h-4 text-blue-400" />
    if (upper.includes('SF') || upper.includes('SOLAR')) return <Sun className="w-4 h-4 text-yellow-400" />
    if (upper.includes('BESS') || upper.includes('BATTERY')) return <Battery className="w-4 h-4 text-green-400" />
    return <Zap className="w-4 h-4 text-gray-400" />
  }

  if (loading) return <div className="p-4 text-yellow-400">Loading generators...</div>

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header with Search */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold mb-3">Generators</h2>
        
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search generators..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        
        <p className="text-sm text-gray-400 mt-2">
          {filteredGenerators.length} of {generators.length} units
        </p>
      </div>
      
      {/* Generator List */}
      <div className="flex-1 overflow-y-auto">
        {filteredGenerators.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No generators found matching "{searchTerm}"
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {filteredGenerators.map((gen) => (
              <div
                key={gen.DUID}
                onClick={() => onSelectGenerator(gen.DUID)}
                className={`p-3 hover:bg-gray-800 cursor-pointer transition-colors flex items-center justify-between ${
                  selectedGenerator === gen.DUID ? 'bg-gray-800 border-l-2 border-blue-500' : ''
                }`}
              >
                <div className="flex items-center space-x-2">
                  {getFuelIcon(gen.DUID)}
                  <div>
                    <div className="font-medium">{gen.DUID}</div>
                    <div className="text-sm text-gray-400">
                      {gen.SCADAVALUE ? `${gen.SCADAVALUE.toFixed(1)} MW` : 'Offline'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}