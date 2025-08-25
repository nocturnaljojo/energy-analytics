'use client'
import { useState } from 'react'
import GeneratorList from './components/GeneratorList'
import PowerChart from './components/PowerChart'

export default function Home() {
  const [selectedGenerator, setSelectedGenerator] = useState<string | null>(null)

  return (
    <div className="flex h-screen bg-gray-950">
      <div className="w-1/3 border-r border-gray-800">
        <GeneratorList onSelectGenerator={setSelectedGenerator} />
      </div>
      
      <div className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-3xl font-bold text-white mb-6">
          Energy Analytics Platform
        </h1>
        
        {selectedGenerator ? (
          <PowerChart generatorDuid={selectedGenerator} />
        ) : (
          <div className="bg-gray-900 rounded-lg p-8 text-center">
            <div className="text-gray-500">
              Select a generator from the list to view its power output over time
            </div>
          </div>
        )}
      </div>
    </div>
  )
}