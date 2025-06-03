
import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Register the datalabels plugin
Chart.register(ChartDataLabels);

const ChartGenerator = ({ selectedChart, selectedXAxis, selectedYAxes, selectedFileData, isLoading, is3DMode }) => {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const chartContainerRef = useRef(null);

  // Helper function to get the last part of a field path (flattened name)
  const getFlattenedFieldName = (path) => {
    if (!path) return null;
    const parts = path.split('.');
    return parts[parts.length - 1].toLowerCase();
  };

  // Create gradient fill for datasets
  const createGradient = (ctx, area, colorStart, colorEnd) => {
    if (!area) return colorStart;
    const gradient = ctx.createLinearGradient(0, area.top || 0, 0, area.bottom || 0);
    gradient.addColorStop(0, colorStart);
    gradient.addColorStop(1, colorEnd);
    return gradient;
  };

  const prepareChartData = () => {
    if (!selectedFileData || !selectedXAxis || !selectedYAxes || selectedYAxes.length === 0) {
      console.error('Missing required data:', { selectedFileData, selectedXAxis, selectedYAxes });
      toast.error('Missing required data to generate chart.');
      return null;
    }

    try {
      const xField = selectedXAxis.value;
      const xFieldFlattened = getFlattenedFieldName(xField);
      const yFields = selectedYAxes.map((yAxis) => yAxis.value);
      const yFieldsFlattened = yFields.map(getFlattenedFieldName);

      if (!xFieldFlattened || yFieldsFlattened.some((field) => !field)) {
        console.error('Invalid field names:', { xFieldFlattened, yFieldsFlattened });
        toast.error('Invalid field names selected.');
        return null;
      }

      const labels = selectedFileData.map((item, index) => {
        const value = item[xFieldFlattened] ?? `Item ${index + 1}`;
        return value.toString();
      });

      const gradientColorPairs = [
        { start: 'rgba(16, 185, 129, 0.9)', end: 'rgba(52, 211, 153, 0.5)' }, // Emerald
        { start: 'rgba(220, 60, 60, 0.9)', end: 'rgba(253, 113, 133, 0.5)' },   // Red
        { start: 'rgba(59, 130, 246, 0.9)', end: 'rgba(147, 197, 253, 0.5)' },  // Blue
        { start: 'rgba(234, 179, 8, 0.9)', end: 'rgba(250, 252, 21, 0.5)' },   // Yellow
        { start: 'rgba(139, 75, 246, 0.9)', end: 'rgba(196, 181, 253, 0.5)' }, // Purple
        { start: 'rgba(234, 88, 12, 0.9)', end: 'rgba(253, 146, 60, 0.5)' },   // Orange
      ];

      const pieColors = [
        '#10B981', '#EF4444', '#3B82F6', '#EAB308', '#8B5CF6', '#EA580C',
        '#EC4899', '#14B8A6', '#F97316', '#A855F7', '#22C55E', '#0EA5E9',
      ];

      let datasets = [];

      if (selectedChart === 'waterfall') {
        const yFieldFlattened = yFieldsFlattened[0];
        let cumulative = 0;
        const data = selectedFileData.map((item, itemIndex) => {
          let value = item[yFieldFlattened] ?? null;
          if (value == null || isNaN(value)) {
            console.warn(`Invalid Y value at item ${itemIndex} for field ${yFields[0]}:`, value);
            return { base: cumulative, value: 0, cumulative };
          }
          value = Number(value);
          const base = cumulative;
          cumulative += value;
          return { base, value, cumulative };
        });

        datasets.push({
          label: selectedYAxes[0].label,
          data: data.map(d => d.value),
          base: data.map(d => d.base),
          backgroundColor: (ctx) => {
            const chart = ctx.chart;
            const { ctx: canvasCtx, chartArea } = chart;
            const value = data[ctx.dataIndex].value;
            return value >= 0
              ? createGradient(canvasCtx, chartArea, 'rgba(16, 185, 129, 0.9)', 'rgba(52, 211, 153, 0.5)')
              : createGradient(canvasCtx, chartArea, 'rgba(220, 60, 60, 0.9)', 'rgba(253, 113, 133, 0.5)');
          },
          borderColor: (ctx) => (data[ctx.dataIndex].value >= 0 ? '#10B981' : '#EF4444'),
          borderWidth: 1,
          connectorLines: data, // Store for custom drawing
        });
      } else if (selectedChart === 'area') {
        datasets = yFields.map((yField, index) => {
          const yFieldFlattened = yFieldsFlattened[index];
          const data = selectedFileData.map((item, itemIndex) => {
            let value = item[yFieldFlattened] ?? null;
            if (value == null || isNaN(value)) {
              console.warn(`Invalid Y value at item ${itemIndex} for field ${yField}:`, value);
              return null;
            }
            return Number(value);
          });

          const colorIndex = index % gradientColorPairs.length;
          return {
            label: selectedYAxes[index].label,
            data,
            backgroundColor: (ctx) => {
              const chart = ctx.chart;
              const { ctx: canvasCtx, chartArea } = chart;
              return createGradient(canvasCtx, chartArea, gradientColorPairs[colorIndex].start, gradientColorPairs[colorIndex].end);
            },
            borderColor: gradientColorPairs[colorIndex].start.replace('0.9', '1'),
            borderWidth: 2,
            fill: true,
            tension: 0.4,
          };
        });
      } else if (selectedChart === 'stackedbar') {
        datasets = yFields.map((yField, index) => {
          const yFieldFlattened = yFieldsFlattened[index];
          const data = selectedFileData.map((item, itemIndex) => {
            let value = item[yFieldFlattened] ?? null;
            if (value == null || isNaN(value)) {
              console.warn(`Invalid Y value at item ${itemIndex} for field ${yField}:`, value);
              return null;
            }
            return Number(value);
          });

          const colorIndex = index % gradientColorPairs.length;
          return {
            label: selectedYAxes[index].label,
            data,
            backgroundColor: (ctx) => {
              const chart = ctx.chart;
              const { ctx: canvasCtx, chartArea } = chart;
              return createGradient(canvasCtx, chartArea, gradientColorPairs[colorIndex].start, gradientColorPairs[colorIndex].end);
            },
            borderColor: gradientColorPairs[colorIndex].start.replace('0.9', '1'),
            borderWidth: 2,
            stack: 'Stack 0',
          };
        });
      } else if (selectedChart === 'radar') {
        datasets = yFields.map((yField, index) => {
          const yFieldFlattened = yFieldsFlattened[index];
          const data = selectedFileData.map((item, itemIndex) => {
            let value = item[yFieldFlattened] ?? null;
            if (value == null || isNaN(value)) {
              console.warn(`Invalid Y value at item ${itemIndex} for field ${yField}:`, value);
              return null;
            }
            return Number(value);
          });

          const colorIndex = index % pieColors.length;
          return {
            label: selectedYAxes[index].label,
            data,
            backgroundColor: pieColors[colorIndex] + '80',
            borderColor: pieColors[colorIndex],
            borderWidth: 2,
            fill: true,
          };
        });
      } else {
        datasets = yFields.map((yField, index) => {
          const yFieldFlattened = yFieldsFlattened[index];
          const data = selectedFileData.map((item, itemIndex) => {
            let value = item[yFieldFlattened] ?? null;
            if (value == null || isNaN(value)) {
              console.warn(`Invalid Y value at item ${itemIndex} for field ${yField}:`, value);
              return null;
            }
            return Number(value);
          });

          if (selectedChart === 'pie') {
            const backgroundColors = data.map((_, dataIndex) => pieColors[dataIndex % pieColors.length]);
            return {
              label: selectedYAxes[index].label,
              data,
              backgroundColor: backgroundColors,
              borderColor: backgroundColors.map(color => color.replace('0.9', '1')),
              borderWidth: 1,
            };
          }

          const colorIndex = index % gradientColorPairs.length;
          return {
            label: selectedYAxes[index].label,
            data,
            backgroundColor: (ctx) => {
              const chart = ctx.chart;
              const { ctx: canvasCtx, chartArea } = chart;
              return createGradient(canvasCtx, chartArea, gradientColorPairs[colorIndex].start, gradientColorPairs[colorIndex].end);
            },
            borderColor: gradientColorPairs[colorIndex].start.replace('0.9', '1'),
            borderWidth: 2,
            fill: selectedChart === 'line' ? false : true,
            tension: selectedChart === 'line' ? 0.4 : undefined,
            pointRadius: selectedChart === 'scatter' ? 6 : 3,
            pointHoverRadius: 8,
            pointBackgroundColor: gradientColorPairs[colorIndex].start,
          };
        });
      }

      const hasValidData = datasets.some((dataset) => dataset.data.some((value) => value != null));
      if (!hasValidData) {
        console.warn('No valid data points found:', datasets);
        toast.error('No valid data to display. Please check your data.');
        return null;
      }

      const labelCounts = {};
      const uniqueLabels = labels.map((label, index) => {
        if (labelCounts[label]) {
          labelCounts[label]++;
          return `${label} (${labelCounts[label]})`;
        }
        labelCounts[label] = 1;
        return label;
      });

      return {
        labels: uniqueLabels,
        datasets,
      };
    } catch (error) {
      console.error('Error preparing chart data:', error);
      toast.error('Failed to prepare chart data. Please check your data.');
      return null;
    }
  };

  const downloadJPG = () => {
    if (!chartContainerRef.current) return;
    html2canvas(chartContainerRef.current, { scale: 2 }).then((canvas) => {
      const link = document.createElement('a');
      link.download = 'chart.jpg';
      link.href = canvas.toDataURL('image/jpeg', 1.0);
      link.click();
      toast.success('Chart downloaded as JPG!');
    }).catch((error) => {
      console.error('Error downloading JPG:', error);
      toast.error('Failed to download JPG.');
    });
  };

  const downloadPDF = () => {
    if (!chartContainerRef.current) return;
    html2canvas(chartContainerRef.current, { scale: 2 }).then((canvas) => {
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 10, 10, imgWidth, imgHeight);
      pdf.save('chart.pdf');
      toast.success('Chart downloaded as PDF!');
    }).catch((error) => {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF.');
    });
  };

  const createChart = () => {
    if (!chartRef.current) {
      console.error('Chart canvas ref is not available.');
      return;
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) {
      console.error('Failed to get 2D context for canvas.');
      return;
    }

    const chartData = prepareChartData();
    if (!chartData) {
      return;
    }

    if (chartInstanceRef.current) {
      try {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      } catch (error) {
        console.error('Error destroying chart instance:', error);
        ctx.clearRect(0, 0, chartRef.current.width, chartRef.current.height);
      }
    }

    let chartType = selectedChart;
    if (selectedChart === 'waterfall') chartType = 'bar';
    if (selectedChart === 'area') chartType = 'line';
    if (selectedChart === 'stackedbar') chartType = 'bar';

    const config = {
      type: chartType,
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 1000,
          easing: 'easeOutQuart',
          animateScale: true,
          animateRotate: true,
        },
        plugins: {
          legend: {
            display: selectedChart !== 'pie',
            position: 'top',
            labels: {
              font: { size: 16, weight: 'bold', family: "'Inter', sans-serif" },
              color: '#1F2937',
              padding: 30,
              boxWidth: 25,
            },
          },
          title: {
            display: true,
            text: `${selectedChart.charAt(0).toUpperCase() + selectedChart.slice(1)} Chart`,
            font: { size: 24, weight: 'bold', family: "'Inter', sans-serif" },
            color: '#1F2937',
            padding: { top: 20, bottom: 30 },
          },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            titleFont: { size: 16, weight: 'bold', family: "'Inter', sans-serif" },
            bodyFont: { size: 14, family: "'Inter', sans-serif" },
            padding: 15,
            cornerRadius: 8,
            callbacks: {
              label: (context) => {
                const value = context.raw;
                if (value == null) return '';
                return `${context.dataset.label}: ${formatNumber(value)}`;
              },
            },
          },
          datalabels: {
            display: selectedChart !== 'pie' && selectedChart !== 'radar',
            color: '#1F2937',
            font: { size: 14, weight: 'bold', family: "'Inter', sans-serif" },
            formatter: (value, ctx) => {
              if (selectedChart === 'waterfall') {
                const data = ctx.dataset.connectorLines[ctx.dataIndex];
                return formatNumber(data.cumulative);
              }
              return value != null ? formatNumber(value) : '';
            },
            padding: 8,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            borderRadius: 4,
            borderWidth: 1,
            borderColor: 'rgba(0, 0, 0, 0.1)',
            anchor: 'end',
            align: 'top',
            offset: 6,
          },
        },
        scales:
          selectedChart === 'pie' || selectedChart === 'radar'
            ? selectedChart === 'radar'
              ? {
                  r: {
                    angleLines: { display: true },
                    grid: { color: 'rgba(0, 0, 0, 0.1)' },
                    ticks: {
                      beginAtZero: true,
                      font: { size: 14, family: "'Inter', sans-serif" },
                      color: '#1F2937',
                      callback: (value) => formatNumber(value),
                    },
                    pointLabels: {
                      font: { size: 14, family: "'Inter', sans-serif" },
                      color: '#1F2937',
                    },
                  },
                }
              : {}
            : {
                x: {
                  title: {
                    display: true,
                    text: selectedXAxis.label,
                    font: { size: 16, weight: 'bold', family: "'Inter', sans-serif" },
                    color: '#1F2937',
                    padding: { top: 15, bottom: 10 },
                  },
                  grid: { display: false },
                  ticks: {
                    color: '#1F2937',
                    font: { size: 14, family: "'Inter', sans-serif" },
                    maxRotation: 45,
                    minRotation: 45,
                    padding: 15,
                  },
                  stacked: selectedChart === 'stackedbar',
                },
                y: {
                  title: {
                    display: true,
                    text: selectedYAxes.length === 1 ? selectedYAxes[0].label : 'Values',
                    font: { size: 16, weight: 'bold', family: "'Inter', sans-serif" },
                    color: '#1F2937',
                    padding: { bottom: 15, top: 10 },
                  },
                  grid: { color: 'rgba(0, 0, 0, 0.05)', borderDash: [5, 5] },
                  ticks: {
                    color: '#1F2937',
                    font: { size: 14, family: "'Inter', sans-serif" },
                    callback: (value) => formatNumber(value),
                  },
                  beginAtZero: true,
                  stacked: selectedChart === 'stackedbar',
                },
              },
        elements: {
          point: {
            radius: selectedChart === 'scatter' ? 8 : 4,
            hoverRadius: 10,
            hoverBorderWidth: 2,
          },
          line: {
            borderWidth: 3,
            tension: 0.4,
          },
          bar: {
            borderWidth: selectedChart === 'stackedbar' ? 2 : 1,
            borderRadius: selectedChart === 'stackedbar' ? 4 : 6,
            barPercentage: selectedChart === 'stackedbar' ? 0.7 : 0.8,
            categoryPercentage: selectedChart === 'stackedbar' ? 0.5 : 0.6,
          },
        },
        layout: {
          padding: 40,
        },
      },
    };

    const formatNumber = (value) => {
      if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
      return value.toFixed(0);
    };

    if (selectedChart === 'pie') {
      config.options.plugins.legend = {
        display: true,
        position: 'right',
        labels: {
          font: { size: 16, weight: 'bold', family: "'Inter', sans-serif" },
          color: '#1F2937',
          padding: 30,
          generateLabels: (chart) => {
            const data = chart.data;
            return data.labels.map((label, i) => ({
              text: label,
              fillStyle: data.datasets[0].backgroundColor[i],
              strokeStyle: data.datasets[0].borderColor[i],
              lineWidth: 1,
              hidden: false,
              index: i,
            }));
          },
        },
      };
      config.options.plugins.datalabels = {
        display: true,
        color: '#fff',
        font: { size: 14, weight: 'bold', family: "'Inter', sans-serif" },
        formatter: (value, ctx) => {
          const total = ctx.dataset.data.reduce((sum, val) => sum + (val || 0), 0);
          const percentage = ((value / total) * 100).toFixed(1);
          return value != null ? `${percentage}%` : '';
        },
        textAlign: 'center',
        padding: 6,
      };
      config.options.plugins.tooltip.callbacks = {
        label: (context) => {
          const value = context.raw;
          if (value == null) return '';
          const total = context.dataset.data.reduce((sum, val) => sum + (val || 0), 0);
          const percentage = ((value / total) * 100).toFixed(1);
          return `${context.label}: ${formatNumber(value)} (${percentage}%)`;
        },
      };
    }

    if (selectedChart === 'waterfall') {
      config.options.scales.y.stacked = false;
      config.plugins = config.plugins || [];
      config.plugins.push({
        id: 'waterfallConnectors',
        afterDatasetsDraw: (chart) => {
          const ctx = chart.ctx;
          const dataset = chart.data.datasets[0];
          const meta = chart.getDatasetMeta(0);
          const data = dataset.connectorLines;

          meta.data.forEach((bar, index) => {
            if (index === 0) return; // Skip connector for the first bar

            const prevBar = meta.data[index - 1];
            const currentBar = bar;

            const prevX = prevBar.x + prevBar.width / 2;
            const prevY = prevBar.y;
            const currentX = currentBar.x - currentBar.width / 2;
            const currentY = currentBar.y + (data[index].value < 0 ? currentBar.height : 0);

            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.lineWidth = 1;
            ctx.moveTo(prevX, prevY);
            ctx.lineTo(currentX, currentY);
            ctx.stroke();
            ctx.restore();
          });
        },
      });
    }

    if (selectedChart === 'area') {
      config.data.datasets.forEach(dataset => {
        dataset.fill = true;
      });
    }

    if (selectedChart === 'stackedbar') {
      config.options.scales.x.stacked = true;
      config.options.scales.y.stacked = true;
      config.options.elements.bar.borderWidth = 2;
      config.options.elements.bar.borderColor = '#FFFFFF'; // White border for separation
    }

    if ((selectedChart === 'bar' || selectedChart === 'stackedbar') && is3DMode) {
      config.plugins = config.plugins || [];
      config.plugins.push({
        id: 'custom3D',
        afterDraw: (chart) => {
          const ctx = chart.ctx;
          chart.data.datasets.forEach((dataset, datasetIndex) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            meta.data.forEach((bar, index) => {
              const { x, y, width, height } = bar;
              ctx.save();
              ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
              ctx.beginPath();
              ctx.rect(x, y + height, width, 5);
              ctx.fill();
              ctx.restore();
            });
          });
        },
      });
    }

    try {
      chartInstanceRef.current = new Chart(ctx, config);
    } catch (error) {
      console.error('Error creating chart:', error);
      toast.error('Failed to create chart. Please check the console for details.');
    }
  };

  useEffect(() => {
    if (!isLoading) {
      createChart();
    }

    return () => {
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.destroy();
          chartInstanceRef.current = null;
        } catch (error) {
          console.error('Error during chart cleanup:', error);
          if (chartRef.current) {
            const ctx = chartRef.current.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, chartRef.current.width, chartRef.current.height);
            }
          }
        }
      }
    };
  }, [selectedChart, selectedXAxis, selectedYAxes, selectedFileData, isLoading, is3DMode]);

  return (
    <div className="mt-12 bg-white rounded-2xl shadow-2xl border border-gray-100 p-8 relative text-lg">
      <h3 className="text-2xl font-semibold text-gray-900 mb-6">Chart Preview</h3>
      <div className="absolute top-8 right-8 flex space-x-4">
        <button
          onClick={downloadJPG}
          className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 font-medium shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
          </svg>
          Download JPG
        </button>
        <button
          onClick={downloadPDF}
          className="flex items-center px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors duration-200 font-medium shadow-md focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          Download PDF
        </button>
      </div>
      <div ref={chartContainerRef} className="relative" style={{ height: '700px', padding: '20px' }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <svg
              className="animate-spin h-12 w-12 text-indigo-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        ) : (
          <div
            className={`w-full h-full transition-all duration-500 ${is3DMode && (selectedChart === 'bar' || selectedChart === 'stackedbar') ? 'transform rotate-x-15 rotate-y-15 shadow-3d' : ''}`}
          >
            <canvas ref={chartRef} className="w-full h-full" />
          </div>
        )}
      </div>
    </div>
  );
};

// Add custom styles for 3D effect
const style = document.createElement('style');
style.innerHTML = `
  .rotate-x-15 {
    transform: rotateX(15deg);
  }
  .rotate-y-15 {
    transform: rotateY(15deg);
  }
  .shadow-3d {
    box-shadow: 10px 10px 20px rgba(0, 0, 0, 0.3), -10px -10px 20px rgba(255, 255, 255, 0.5);
  }
`;
document.head.appendChild(style);

export default ChartGenerator;