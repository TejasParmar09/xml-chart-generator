import React, { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import Plotly from 'plotly.js-dist-min';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

function XmlForm({ editingItem, onChartRender }) {
  const [error, setError] = useState('');
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const plotlyRef = useRef(null);
  const containerRef = useRef(null);

  const colors = [
    'rgba(79, 70, 229, 0.7)',
    'rgba(236, 72, 153, 0.7)',
    'rgba(16, 185, 129, 0.7)',
    'rgba(251, 146, 60, 0.7)',
    'rgba(147, 51, 234, 0.7)'
  ];

  const cleanFieldName = (field) => {
    // Remove numeric prefixes, array indices, and special characters; normalize to lowercase
    return field
      .replace(/\[\d+\]/g, '') // Remove [0], [1], etc.
      .replace(/^\d+-/, '') // Remove 0-, 1-, etc.
      .replace(/[^a-zA-Z0-9]/g, '') // Remove special characters
      .toLowerCase();
  };

  useEffect(() => {
    if (!editingItem) {
      setError('No chart configuration provided');
      return;
    }

    try {
      // Validate input data
      if (!editingItem.file || !editingItem.chartType || !editingItem.xAxis || !editingItem.yAxis) {
        throw new Error('Missing required chart configuration');
      }

      let data;
      try {
        data = JSON.parse(editingItem.file);
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('Invalid data format: expected non-empty array');
        }
      } catch (e) {
        console.error('Data parsing error:', e);
        throw new Error('Failed to parse chart data');
      }

      const { chartType, xAxis, yAxis } = editingItem;

      // Function to aggregate values for a field (e.g., sum 0-score, 1-score, etc.)
      const getAggregatedValue = (item, field) => {
        let total = 0;
        const cleanedField = cleanFieldName(field);
        for (const key in item) {
          const baseKey = cleanFieldName(key);
          if (baseKey === cleanedField) {
            const value = parseFloat(item[key]);
            if (!isNaN(value)) {
              total += value;
            }
          }
        }
        console.log(`Aggregated value for field "${field}" in item:`, item, `Total: ${total}`);
        return total;
      };

      // Validate data points and log warnings for missing values
      data.forEach((item, index) => {
        const xKeys = Object.keys(item).filter(key => cleanFieldName(key) === cleanFieldName(xAxis));
        if (!item[xAxis] && xKeys.length === 0) {
          console.warn(`Missing X-axis value for "${xAxis}" at index ${index}`);
        }
        if (Array.isArray(yAxis)) {
          yAxis.forEach(y => {
            const yKeys = Object.keys(item).filter(key => cleanFieldName(key) === cleanFieldName(y));
            if (!item[y] && yKeys.length === 0) {
              console.warn(`Missing Y-axis value for "${y}" at index ${index}`);
            }
          });
        } else {
          const yKeys = Object.keys(item).filter(key => cleanFieldName(key) === cleanFieldName(yAxis));
          if (!item[yAxis] && yKeys.length === 0) {
            console.warn(`Missing Y-axis value for "${yAxis}" at index ${index}`);
          }
        }
      });

      // Clean up existing chart
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }

      if (chartType === '3d') {
        // 3D chart will be handled by Plotly in the second useEffect
        return;
      }

      const ctx = chartRef.current?.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // Create gradients for pie chart
      const pieGradients = Array.isArray(yAxis) ? yAxis.map((_, index) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, colors[index % colors.length].replace('0.7', '0.9'));
        gradient.addColorStop(1, colors[index % colors.length].replace('0.7', '0.4'));
        return gradient;
      }) : [];

      // Prepare datasets with data validation and aggregation
      const datasets = (Array.isArray(yAxis) ? yAxis : [yAxis]).map((yKey, index) => {
        const dataset = {
          label: formatFieldName(yKey),
          data: data.map(item => {
            const value = getAggregatedValue(item, yKey);
            if (value === 0) {
              const yKeys = Object.keys(item).filter(key => cleanFieldName(key) === cleanFieldName(yKey));
              if (yKeys.length === 0) {
                console.warn(`No valid value found for "${yKey}" in item:`, item);
                return 0;
              }
            }
            return value;
          }),
          borderWidth: chartType === 'line' ? 2 : 1,
          fill: chartType === 'line',
          tension: chartType === 'line' ? 0.4 : 0,
          borderRadius: chartType === 'bar' ? 8 : 0,
        };

        if (chartType === 'pie') {
          dataset.backgroundColor = pieGradients;
          dataset.borderColor = '#ffffff';
          dataset.borderWidth = 2;
          dataset.hoverOffset = 20;
        } else {
          dataset.backgroundColor = colors[index % colors.length];
          dataset.borderColor = colors[index % colors.length].replace('0.7', '1');
        }

        return dataset;
      });

      // Prepare labels with validation
      const labels = data.map((item, index) => {
        let label = item[xAxis];
        const cleanedXAxis = cleanFieldName(xAxis);
        if (!label) {
          const xKeys = Object.keys(item).filter(key => cleanFieldName(key) === cleanedXAxis);
          if (xKeys.length > 0) {
            label = item[xKeys[0]]; // Use the first matching value
          }
        }
        if (label === null || label === undefined) {
          console.warn(`Missing label at index ${index}`);
          return `Item ${index + 1}`;
        }
        return label.toString();
      });

      // Chart configuration
      const config = {
        type: chartType === 'pie' ? 'doughnut' : chartType,
        data: {
          labels,
          datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: chartType === 'pie' ? 'right' : 'top',
              labels: {
                font: { size: 12, family: "'Roboto', sans-serif" },
                color: '#1f2937',
                padding: 15,
              },
            },
            tooltip: {
              enabled: true,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleFont: { size: 12 },
              bodyFont: { size: 11 },
              padding: 10,
              callbacks: {
                label: function(context) {
                  const value = context.raw;
                  return typeof value === 'number' 
                    ? value.toLocaleString()
                    : value;
                }
              }
            },
            datalabels: {
              display: chartType !== 'line',
              color: (context) => {
                if (chartType === 'pie') return '#ffffff';
                return '#1f2937';
              },
              font: { size: 11, weight: 'bold' },
              formatter: (value) => {
                return typeof value === 'number' 
                  ? value.toLocaleString()
                  : value;
              },
              backgroundColor: (context) => {
                if (chartType === 'bar') {
                  return 'rgba(255, 255, 255, 0.8)';
                }
                return null;
              },
              padding: { top: 2, bottom: 2, left: 4, right: 4 },
              borderRadius: 4,
              anchor: (context) => {
                if (chartType === 'bar') return 'end';
                if (chartType === 'pie') return 'center';
                return 'center';
              },
              align: (context) => {
                if (chartType === 'bar') return 'bottom';
                if (chartType === 'pie') return 'center';
                return 'center';
              },
              offset: (context) => {
                if (chartType === 'bar') return 0;
                if (chartType === 'pie') return 0;
                return 4;
              },
              rotation: (context) => {
                if (chartType === 'bar') return 0;
                return 0;
              },
              display: (context) => {
                if (!context.dataset.data) return false;
                const dataset = context.dataset;
                const value = dataset.data[context.dataIndex];
                if (chartType === 'bar' && typeof value === 'number') {
                  const max = Math.max(...dataset.data.filter(v => typeof v === 'number'));
                  return value >= max * 0.05;
                }
                return true;
              }
            },
          },
          scales: chartType !== 'pie' ? {
            x: {
              grid: { display: false },
              ticks: { 
                font: { size: 11 },
                callback: function(value) {
                  const label = this.getLabelForValue(value);
                  return label.length > 15 ? label.substring(0, 12) + '...' : label;
                }
              },
            },
            y: {
              beginAtZero: true,
              grid: { color: '#e5e7eb' },
              ticks: { 
                font: { size: 11 },
                callback: function(value) {
                  return typeof value === 'number' 
                    ? value.toLocaleString()
                    : value;
                }
              },
            },
          } : undefined,
        },
      };

      // Create new chart
      chartInstanceRef.current = new Chart(ctx, config);
      
      // Notify parent component about the chart reference
      if (onChartRender) {
        onChartRender({ canvas: chartRef.current, plotly: plotlyRef.current });
      }

    } catch (err) {
      console.error('Chart rendering error:', err);
      setError(err.message);
    }

    // Cleanup
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [editingItem]);

  // 3D Chart Handling with Plotly
  if (editingItem?.chartType === '3d') {
    useEffect(() => {
      if (!containerRef.current || !editingItem) return;

      const cleanFieldName = (field) => {
        return field
          .replace(/\[\d+\]/g, '')
          .replace(/^\d+-/, '')
          .replace(/[^a-zA-Z0-9]/g, '')
          .toLowerCase();
      };

      const getAggregatedValue = (item, field) => {
        let total = 0;
        const cleanedField = cleanFieldName(field);
        for (const key in item) {
          const baseKey = cleanFieldName(key);
          if (baseKey === cleanedField) {
            const value = parseFloat(item[key]);
            if (!isNaN(value)) {
              total += value;
            }
          }
        }
        console.log(`Aggregated value for field "${field}" in item:`, item, `Total: ${total}`);
        return total;
      };

      try {
        const data = JSON.parse(editingItem.file);
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('Invalid data format for 3D chart: expected non-empty array');
        }

        const cleanedXAxis = cleanFieldName(editingItem.xAxis);
        const xValues = data.map(item => {
          let value = item[editingItem.xAxis];
          if (!value) {
            const xKeys = Object.keys(item).filter(key => cleanFieldName(key) === cleanedXAxis);
            value = xKeys.length > 0 ? item[xKeys[0]] : 'Unknown';
          }
          return value;
        });
        const yValues = data.map(item => getAggregatedValue(item, editingItem.yAxis[0]));
        const zValues = data.map(item => getAggregatedValue(item, editingItem.yAxis[1] || editingItem.yAxis[0]));

        const plotlyData = [{
          type: 'scatter3d',
          mode: 'markers',
          x: xValues,
          y: yValues,
          z: zValues,
          marker: {
            size: 8,
            color: yValues,
            colorscale: 'Viridis',
            opacity: 0.8,
          },
        }];

        const layout = {
          margin: { l: 0, r: 0, b: 0, t: 0 },
          scene: {
            camera: { eye: { x: 1.5, y: 1.5, z: 1 } },
          },
        };

        const config = {
          responsive: true,
          toImageButtonOptions: {
            format: 'png',
            filename: 'chart',
            height: 500,
            width: 700,
            scale: 2
          }
        };

        Plotly.newPlot(containerRef.current, plotlyData, layout, config);

        // Notify parent component about the chart reference
        if (onChartRender) {
          onChartRender({ canvas: chartRef.current, plotly: containerRef.current });
        }
      } catch (err) {
        console.error('3D Chart rendering error:', err);
        setError(err.message);
      }

      // Cleanup
      return () => {
        if (containerRef.current) {
          Plotly.purge(containerRef.current);
        }
      };
    }, [editingItem]);

    return <div className="w-full h-full" ref={containerRef} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-red-500 text-center p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="font-medium mb-2">Failed to render chart</p>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full" ref={containerRef}>
      <canvas ref={chartRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

const formatFieldName = (field) => {
  return field
    .split(/[-_\s.]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default XmlForm;