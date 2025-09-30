import React from 'react'
import { BarChart3 } from 'lucide-react'

export type MetricType = 'runs' | 'cost'
export type TimePeriod = 'day' | 'week' | 'month'

interface AnalyticsChartProps {
  data: Array<{ 
    date: string; 
    runs: number; 
    cost: number;
    executions: Array<{
      id: string;
      file_name?: string;
      status: string;
      cost: number;
    }>
  }>
  metric: MetricType
  period: TimePeriod
}

const AnalyticsChart: React.FC<AnalyticsChartProps> = ({ data, metric, period }) => {
  const [hoveredBar, setHoveredBar] = React.useState<{
    data: any;
    x: number;
    y: number;
    width?: number;
  } | null>(null)
  
  const chartHeight = 240
  const chartWidth = 600
  const padding = 30

  // Group data by period
  const groupedData = React.useMemo(() => {
    if (period === 'day') return data
    
    const groups = new Map<string, { runs: number; cost: number; executions: any[] }>()
    
    data.forEach(item => {
      const date = new Date(item.date)
      let key: string
      
      if (period === 'week') {
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        key = weekStart.toISOString().split('T')[0]
      } else { // month
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      }
      
      if (!groups.has(key)) {
        groups.set(key, { runs: 0, cost: 0, executions: [] })
      }
      const group = groups.get(key)!
      group.runs += item.runs
      group.cost += item.cost
      group.executions.push(...item.executions)
    })
    
    return Array.from(groups.entries()).map(([date, values]) => ({
      date,
      runs: values.runs,
      cost: values.cost,
      executions: values.executions
    })).sort((a, b) => a.date.localeCompare(b.date))
  }, [data, period])

  const chartValues = groupedData.map(d => metric === 'runs' ? d.runs : d.cost)
  const chartMaxValue = Math.max(...chartValues, 1)

  if (groupedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <BarChart3 className="h-8 w-8 mx-auto mb-2" />
          <span className="text-sm">No data available</span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative">
      <svg 
        width="100%" 
        height="100%" 
        viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`} 
        className="overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const y = padding + (chartHeight - padding * 2) * ratio
          const value = chartMaxValue * (1 - ratio)
          
          return (
            <g key={ratio}>
              <line
                x1={padding}
                y1={y}
                x2={chartWidth - padding}
                y2={y}
                stroke="#f3f4f6"
                strokeWidth="1"
              />
              <text
                x={padding - 8}
                y={y + 3}
                fontSize="10"
                fill="#9ca3af"
                textAnchor="end"
                className="font-mono"
              >
                {metric === 'cost' 
                  ? `$${value.toFixed(value < 1 ? 2 : 0)}`
                  : Math.round(value)
                }
              </text>
            </g>
          )
        })}

        {/* Chart bars */}
        {groupedData.map((item, index) => {
          const value = metric === 'runs' ? item.runs : item.cost
          const barHeight = chartMaxValue > 0 ? ((chartHeight - padding * 2) * value) / chartMaxValue : 0
          const barWidth = Math.max(8, (chartWidth - padding * 2) / groupedData.length * 0.7)
          const x = padding + (index * (chartWidth - padding * 2)) / groupedData.length + ((chartWidth - padding * 2) / groupedData.length - barWidth) / 2
          const y = chartHeight - padding - barHeight

          return (
            <g key={item.date}>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(1, barHeight)}
                fill={metric === 'runs' ? '#3b82f6' : '#10b981'}
                className="hover:opacity-80 transition-opacity cursor-pointer"
                rx="2"
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const parentSvg = e.currentTarget.closest('svg')?.getBoundingClientRect()
                  if (parentSvg) {
                    setHoveredBar({
                      data: item,
                      x: rect.left - parentSvg.left,
                      y: rect.top - parentSvg.top,
                      width: barWidth
                    })
                  }
                }}
                onMouseLeave={() => setHoveredBar(null)}
              />
              
              {/* X-axis labels - only show every few labels to prevent overlap */}
              {(index % Math.max(1, Math.floor(groupedData.length / 8)) === 0 || index === groupedData.length - 1) && (
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 15}
                  fontSize="9"
                  fill="#6b7280"
                  textAnchor="middle"
                  className="font-medium"
                >
                  {period === 'month' 
                    ? new Date(item.date + (item.date.includes('-01') ? '' : '-01')).toLocaleDateString('en-US', { month: 'short' })
                    : new Date(item.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })
                  }
                </text>
              )}
            </g>
          )
        })}

        {/* X-axis line */}
        <line
          x1={padding}
          y1={chartHeight - padding}
          x2={chartWidth - padding}
          y2={chartHeight - padding}
          stroke="#e5e7eb"
          strokeWidth="1"
        />

        {/* Y-axis line */}
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={chartHeight - padding}
          stroke="#e5e7eb"
          strokeWidth="1"
        />
      </svg>

      {/* Enhanced Tooltip */}
      {hoveredBar && (() => {
        const tooltipWidth = 320 // approximate max-width in pixels
        const containerWidth = chartWidth
        const isNearRightEdge = hoveredBar.x + tooltipWidth > containerWidth - 20
        
        return (
          <div
            className="absolute pointer-events-none z-50"
            style={{
              left: isNearRightEdge ? hoveredBar.x - 15 : hoveredBar.x + (hoveredBar.width || 0) + 15,
              top: hoveredBar.y + (chartHeight - hoveredBar.y) / 2,
              transform: isNearRightEdge ? 'translate(-100%, -50%)' : 'translateY(-50%)'
            }}
          >
            <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg max-w-xs">
              <div className="text-sm font-semibold mb-1">
                {new Date(hoveredBar.data.date).toLocaleDateString('en-US', { 
                  weekday: 'short',
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
              
              <div className="space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span>Runs:</span>
                  <span className="font-medium text-blue-300">{hoveredBar.data.runs}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Total Cost:</span>
                  <span className="font-medium text-green-300">${hoveredBar.data.cost.toFixed(2)}</span>
                </div>
                
                {hoveredBar.data.executions && hoveredBar.data.executions.length > 0 && (
                  <>
                    <div className="border-t border-gray-600 pt-1 mt-2">
                      <div className="font-medium mb-1">Files Run:</div>
                      <div className="space-y-0.5 max-h-20 overflow-y-auto">
                        {Array.from(new Set(
                          hoveredBar.data.executions
                            .filter((exec: any) => exec.file_name)
                            .map((exec: any) => exec.file_name as string)
                        )).slice(0, 3).map((fileName, idx) => (
                          <div key={idx} className="text-gray-300 truncate">
                            • {String(fileName)}
                          </div>
                        ))}
                        {Array.from(new Set(
                          hoveredBar.data.executions
                            .filter((exec: any) => exec.file_name)
                            .map((exec: any) => exec.file_name as string)
                        )).length > 3 && (
                          <div className="text-gray-400">
                            +{Array.from(new Set(
                              hoveredBar.data.executions
                                .filter((exec: any) => exec.file_name)
                                .map((exec: any) => exec.file_name as string)
                            )).length - 3} more...
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status breakdown */}
                    <div className="border-t border-gray-600 pt-1 mt-1">
                      <div className="font-medium mb-1">Status:</div>
                      {(() => {
                        const statusCounts = hoveredBar.data.executions.reduce((acc: any, exec: any) => {
                          acc[exec.status] = (acc[exec.status] || 0) + 1
                          return acc
                        }, {})
                        
                        return Object.entries(statusCounts).map(([status, count]: [string, any]) => (
                          <div key={status} className="flex justify-between text-xs">
                            <span className="capitalize text-gray-300">{status}:</span>
                            <span className={`font-medium ${
                              status.toLowerCase() === 'completed' ? 'text-green-300' :
                              status.toLowerCase() === 'failed' ? 'text-red-300' :
                              'text-blue-300'
                            }`}>
                              {count}
                            </span>
                          </div>
                        ))
                      })()}
                    </div>
                  </>
                )}
              </div>
              
              {/* Tooltip arrow */}
              <div className={`absolute top-1/2 transform -translate-y-1/2 ${
                isNearRightEdge 
                  ? 'right-0 translate-x-full' 
                  : 'left-0 -translate-x-full'
              }`}>
                <div className={`border-4 border-transparent ${
                  isNearRightEdge 
                    ? 'border-l-gray-900' 
                    : 'border-r-gray-900'
                }`}></div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default AnalyticsChart