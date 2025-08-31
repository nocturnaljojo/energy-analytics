'use client'
import { useState } from 'react'
import GeneratorList from './components/GeneratorList'
import PowerChart from './components/PowerChart'
import RevenueLeaderboard from './components/RevenueLeaderboard'

export default function Home() {
  const [selectedGenerator, setSelectedGenerator] = useState<string | null>(null)
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [selectedFuelTypes, setSelectedFuelTypes] = useState<string[]>([])
  const [dateRange, setDateRange] = useState('24h')

  // Handler for filter changes from GeneratorList
  const handleFiltersChange = (regions: string[], fuelTypes: string[]) => {
    setSelectedRegions(regions)
    setSelectedFuelTypes(fuelTypes)
  }

  // Handler for date range changes from PowerChart
  const handleDateRangeChange = (range: string) => {
    setDateRange(range)
  }

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Left Panel - Generator List */}
      <div className="w-1/3 min-w-[300px] border-r border-gray-800">
        <GeneratorList 
          onSelectGenerator={setSelectedGenerator}
          selectedGenerator={selectedGenerator}
          onFiltersChange={handleFiltersChange}
        />
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-3xl font-bold text-white mb-6">
          Energy Analytics Platform
        </h1>
        
        {/* Two Column Layout for Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Power Chart - Takes 2 columns */}
          <div className={selectedGenerator ? "xl:col-span-2" : "xl:col-span-3"}>
            {selectedGenerator ? (
              <PowerChart 
                generatorDuid={selectedGenerator}
                onDateRangeChange={handleDateRangeChange}
              />
            ) : (
              <div className="bg-gray-900 rounded-lg p-8 text-center h-[600px] flex items-center justify-center">
                <div>
                  <div className="text-gray-500 text-lg mb-4">
                    Select a generator from the list to view its power output over time
                  </div>
                  <div className="text-gray-600 text-sm">
                    Use the filters on the left to narrow down your search
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Revenue Leaderboard - Right column, always visible when generator selected */}
          {selectedGenerator && (
            <div className="xl:col-span-1">
              <RevenueLeaderboard 
                selectedRegions={selectedRegions}
                selectedFuelTypes={selectedFuelTypes}
                dateRange={dateRange}
              />
            </div>
          )}
        </div>

        {/* Revenue Leaderboard below when no generator selected */}
        {!selectedGenerator && (
          <div className="mt-6">
            <RevenueLeaderboard 
              selectedRegions={selectedRegions}
              selectedFuelTypes={selectedFuelTypes}
              dateRange={dateRange}
            />
          </div>
        )}
      </div>
    </div>
  )
}