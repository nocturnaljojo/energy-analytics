'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, Zap, Wind, Sun, Battery, Filter, X, Flame, Droplets, Atom } from 'lucide-react'

interface Generator {
  duid: string
  station_name: string | null
  participant: string | null
  region: string | null
  fuel_source_primary: string | null
  dispatch_type: string | null
  reg_cap_generation: number | null
  latest_mw?: number | null
  latest_timestamp?: string | null
}

interface GeneratorListProps {
  onSelectGenerator: (duid: string) => void
  selectedGenerator: string | null
  onFiltersChange: (regions: string[], fuelTypes: string[]) => void  // Added this
}

export default function GeneratorList({ 
  onSelectGenerator, 
  selectedGenerator,
  onFiltersChange  // Added this
}: GeneratorListProps) {
  const [generators, setGenerators] = useState<Generator[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(true)
  
  // Filter states - now using arrays for multiple selections
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [selectedFuelTypes, setSelectedFuelTypes] = useState<string[]>([])
  
  // Available filter options
  const [regions, setRegions] = useState<string[]>([])
  const [fuelTypes, setFuelTypes] = useState<string[]>([])

  // Region colors
  const regionColors: Record<string, string> = {
    'NSW1': 'bg-blue-500 hover:bg-blue-600',
    'QLD1': 'bg-purple-500 hover:bg-purple-600',
    'VIC1': 'bg-green-500 hover:bg-green-600',
    'SA1': 'bg-orange-500 hover:bg-orange-600',
    'TAS1': 'bg-red-500 hover:bg-red-600'
  }

  // Fuel type configurations
  const fuelConfig: Record<string, { icon: JSX.Element, color: string }> = {
    'Solar': { icon: <Sun className="w-3 h-3" />, color: 'bg-yellow-500 hover:bg-yellow-600' },
    'Wind': { icon: <Wind className="w-3 h-3" />, color: 'bg-sky-500 hover:bg-sky-600' },
    'Battery Storage': { icon: <Battery className="w-3 h-3" />, color: 'bg-emerald-500 hover:bg-emerald-600' },
    'Battery storage': { icon: <Battery className="w-3 h-3" />, color: 'bg-emerald-500 hover:bg-emerald-600' },
    'Hydro': { icon: <Droplets className="w-3 h-3" />, color: 'bg-cyan-500 hover:bg-cyan-600' },
    'Gas': { icon: <Flame className="w-3 h-3" />, color: 'bg-orange-500 hover:bg-orange-600' },
    'Coal': { icon: <Atom className="w-3 h-3" />, color: 'bg-gray-600 hover:bg-gray-700' },
    'Fossil': { icon: <Flame className="w-3 h-3" />, color: 'bg-gray-600 hover:bg-gray-700' }
  }

  useEffect(() => {
    fetchGenerators()
  }, [])

  const fetchGenerators = async () => {
    const { data: genData, error: genError } = await supabase
      .from('nem_generators')
      .select(`
        duid,
        station_name,
        participant,
        region,
        fuel_source_primary,
        dispatch_type,
        reg_cap_generation
      `)
      .order('duid', { ascending: true })
    
    if (genError) {
      console.error('Error fetching generator metadata:', genError)
      setLoading(false)
      return
    }
    
    const { data: scadaData } = await supabase
      .from('dispatch_unit_scada')
      .select('DUID, SCADAVALUE, SETTLEMENTDATE')
      .order('SETTLEMENTDATE', { ascending: false })
      .limit(1000)
    
    if (genData) {
      const scadaMap = new Map()
      scadaData?.forEach(record => {
        if (!scadaMap.has(record.DUID)) {
          scadaMap.set(record.DUID, {
            latest_mw: record.SCADAVALUE,
            latest_timestamp: record.SETTLEMENTDATE
          })
        }
      })
      
      const combinedData = genData.map(gen => ({
        ...gen,
        latest_mw: scadaMap.get(gen.duid)?.latest_mw || null,
        latest_timestamp: scadaMap.get(gen.duid)?.latest_timestamp || null
      }))
      
      const uniqueRegions = [...new Set(genData.map(g => g.region).filter(Boolean))].sort()
      const uniqueFuelTypes = [...new Set(genData.map(g => g.fuel_source_primary).filter(Boolean))].sort()
      
      setRegions(uniqueRegions)
      setFuelTypes(uniqueFuelTypes)
      setGenerators(combinedData)
    }
    
    setLoading(false)
  }

  // Toggle region selection - UPDATED
  const toggleRegion = (region: string) => {
    const newRegions = selectedRegions.includes(region) 
      ? selectedRegions.filter(r => r !== region)
      : [...selectedRegions, region]
    
    setSelectedRegions(newRegions)
    onFiltersChange(newRegions, selectedFuelTypes)  // Call the callback
  }

  // Toggle fuel type selection - UPDATED
  const toggleFuelType = (fuelType: string) => {
    const newFuelTypes = selectedFuelTypes.includes(fuelType)
      ? selectedFuelTypes.filter(f => f !== fuelType)
      : [...selectedFuelTypes, fuelType]
    
    setSelectedFuelTypes(newFuelTypes)
    onFiltersChange(selectedRegions, newFuelTypes)  // Call the callback
  }

  // Clear all filters - UPDATED
  const clearAllFilters = () => {
    setSelectedRegions([])
    setSelectedFuelTypes([])
    setSearchTerm('')
    onFiltersChange([], [])  // Call the callback with empty arrays
  }

  // Clear regions only - NEW
  const clearRegions = () => {
    setSelectedRegions([])
    onFiltersChange([], selectedFuelTypes)
  }

  // Clear fuel types only - NEW
  const clearFuelTypes = () => {
    setSelectedFuelTypes([])
    onFiltersChange(selectedRegions, [])
  }

  // Filtered generators
  const filteredGenerators = useMemo(() => {
    let filtered = generators
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(gen => 
        gen.duid.toLowerCase().includes(search) ||
        gen.station_name?.toLowerCase().includes(search) ||
        gen.participant?.toLowerCase().includes(search)
      )
    }
    
    if (selectedRegions.length > 0) {
      filtered = filtered.filter(gen => 
        gen.region && selectedRegions.includes(gen.region)
      )
    }
    
    if (selectedFuelTypes.length > 0) {
      filtered = filtered.filter(gen => 
        gen.fuel_source_primary && selectedFuelTypes.includes(gen.fuel_source_primary)
      )
    }
    
    return filtered
  }, [generators, searchTerm, selectedRegions, selectedFuelTypes])

  // Get fuel icon
  const getFuelIcon = (fuelType: string | null) => {
    if (!fuelType) return <Zap className="w-4 h-4 text-gray-400" />
    
    for (const [key, config] of Object.entries(fuelConfig)) {
      if (fuelType.includes(key)) {
        return <div className="w-4 h-4">{config.icon}</div>
      }
    }
    return <Zap className="w-4 h-4 text-gray-400" />
  }

  const activeFilterCount = selectedRegions.length + selectedFuelTypes.length

  if (loading) return <div className="p-4 text-yellow-400">Loading generators...</div>

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold">Generators</h2>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search generators..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        
        {/* Filter Buttons */}
        {showFilters && (
          <div className="space-y-3">
            {/* Region Filter Buttons */}
            <div>
              <div className="text-xs text-gray-400 mb-2 flex items-center justify-between">
                <span>REGIONS</span>
                {selectedRegions.length > 0 && (
                  <button
                    onClick={clearRegions}  // Updated to use specific clear function
                    className="text-gray-500 hover:text-gray-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {regions.map(region => (
                  <button
                    key={region}
                    onClick={() => toggleRegion(region)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all transform ${
                      selectedRegions.includes(region)
                        ? `${regionColors[region] || 'bg-gray-600 hover:bg-gray-700'} text-white scale-105 shadow-lg`
                        : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                    }`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Fuel Type Filter Buttons */}
            <div>
              <div className="text-xs text-gray-400 mb-2 flex items-center justify-between">
                <span>FUEL TYPES</span>
                {selectedFuelTypes.length > 0 && (
                  <button
                    onClick={clearFuelTypes}  // Updated to use specific clear function
                    className="text-gray-500 hover:text-gray-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {fuelTypes.map(fuelType => {
                  const config = fuelConfig[fuelType] || { 
                    icon: <Zap className="w-3 h-3" />, 
                    color: 'bg-gray-600 hover:bg-gray-700' 
                  }
                  return (
                    <button
                      key={fuelType}
                      onClick={() => toggleFuelType(fuelType)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all transform flex items-center gap-1.5 ${
                        selectedFuelTypes.includes(fuelType)
                          ? `${config.color} text-white scale-105 shadow-lg`
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                      }`}
                    >
                      {config.icon}
                      <span>{fuelType}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            
            {/* Clear All Button */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-3 h-3" />
                Clear All Filters ({activeFilterCount})
              </button>
            )}
          </div>
        )}
        
        <p className="text-sm text-gray-400 mt-3">
          {filteredGenerators.length} of {generators.length} units
        </p>
      </div>
      
      {/* Generator List */}
      <div className="flex-1 overflow-y-auto">
        {filteredGenerators.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p>No generators found</p>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="mt-2 text-blue-400 hover:text-blue-300 text-sm"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {filteredGenerators.map((gen) => (
              <div
                key={gen.duid}
                onClick={() => onSelectGenerator(gen.duid)}
                className={`p-3 hover:bg-gray-800 cursor-pointer transition-colors ${
                  selectedGenerator === gen.duid ? 'bg-gray-800 border-l-2 border-blue-500' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 flex-1">
                    <div className="mt-1">{getFuelIcon(gen.fuel_source_primary)}</div>
                    <div className="flex-1">
                      <div className="font-medium">{gen.duid}</div>
                      {gen.station_name && (
                        <div className="text-sm text-gray-400">{gen.station_name}</div>
                      )}
                      <div className="flex flex-wrap gap-2 mt-1">
                        {gen.participant && (
                          <span className="text-xs text-gray-500">{gen.participant}</span>
                        )}
                        {gen.region && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            selectedRegions.includes(gen.region) 
                              ? 'bg-blue-900/50 text-blue-300' 
                              : 'bg-gray-800'
                          }`}>
                            {gen.region}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {gen.latest_mw !== null ? `${gen.latest_mw.toFixed(1)} MW` : '-'}
                      </div>
                      <div className="text-xs text-gray-500">
                        Cap: {gen.reg_cap_generation?.toFixed(0) || '-'} MW
                      </div>
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