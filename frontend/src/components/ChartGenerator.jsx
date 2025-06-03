import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Register the datalabels plugin
Chart.register(ChartDataLabels);

const ChartGenerator = ({ selectedChart, selectedXAxis, selectedYAxes, selectedFileData, isLoading }) => {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // Helper function to get the last part of a field path (flattened name)
  const getFlattenedFieldName = (path) => {
    if (!path) return null;
    const parts = path.split('.');
    return parts[parts.length - 1].toLowerCase();
  };

  // Create gradient fill for datasets with fallback
  const createGradient = (ctx, chartArea, colorStart, colorEnd) => {
    if (!chartArea) {
      return colorStart; // Fallback to solid color
    }
    // For 3D column or bar charts, gradient mimics lighting (top to bottom)
    const gradient = ctx.createLinearGradient(0, chartArea.top || 0, 0, chartArea.bottom || 0);
    gradient.addColorStop(0, colorStart);
    gradient.addColorStop(1, colorEnd);
    return gradient;
  };

  const prepareChartData = () => {
    if (!selectedFileData || !selectedXAxis || selectedYAxes.length === 0) {
      console.error('Missing required data:', { selectedFileData, selectedXAxis, selectedYAxes });
      toast.error('Missing required data to generate chart.');
      return null;
    }

    try {
      const xField = selectedXAxis.value;
      const xFieldFlattened = getFlattenedFieldName(xField);
      const yFields = selectedYAxes.map((yAxis) => yAxis.value);
      const yFieldsFlattened = yFields.map(getFlattenedFieldName);

      // Validate fields
      if (!xFieldFlattened || yFieldsFlattened.some((field) => !field)) {
        console.error('Invalid field names:', { xFieldFlattened, yFieldsFlattened });
        toast.error('Invalid field names selected.');
        return null;
      }

      // Extract X-axis labels
      const labels = selectedFileData.map((item, index) => {
        const value = item[xFieldFlattened] ?? `Item ${index + 1}`;
        return value.toString();
      });

      // Define vibrant color palette for gradients (for bar, column3d, line, scatter)
      const gradientColorPairs = [
        { start: 'rgba(16, 185, 129, 0.8)', end: 'rgba(52, 211, 153, 0.4)' }, // Emerald
        { start: 'rgba(220, 38, 38, 0.8)', end: 'rgba(251, 113, 133, 0.4)' },   // Red
        { start: 'rgba(59, 130, 246, 0.8)', end: 'rgba(147, 197, 253, 0.4)' },  // Blue
        { start: 'rgba(234, 179, 8, 0.8)', end: 'rgba(250, 204, 21, 0.4)' },   // Yellow
        { start: 'rgba(139, 92, 246, 0.8)', end: 'rgba(196, 181, 253, 0.4)' }, // Purple
        { start: 'rgba(234, 88, 12, 0.8)', end: 'rgba(251, 146, 60, 0.4)' },   // Orange
      ];

      // Define distinct solid colors for pie chart (one color per data point)
      const pieColors = [
        '#10B981', // Emerald
        '#EF4444', // Red
        '#3B82F6', // Blue
        '#EAB308', // Yellow
        '#8B5CF6', // Purple
        '#EA580C', // Orange
        '#EC4899', // Pink
        '#14B8A6', // Teal
        '#F97316', // Orange-500
        '#A855F7', // Purple-500
        '#22C55E', // Green-500
        '#0EA5E9', // Sky-500
      ];

      // Extract Y-axis data
      const datasets = yFields.map((yField, index) => {
        const yFieldFlattened = yFieldsFlattened[index];
        const data = selectedFileData.map((item, itemIndex) => {
          let value = item[yFieldFlattened] ?? null;
          if (value == null || isNaN(value)) {
            console.warn(`Invalid Y-axis value at item ${itemIndex} for field ${yField} (flattened: ${yFieldFlattened}):`, value);
            return null;
          }
          return Number(value);
        });

        if (selectedChart === 'pie') {
          // For pie chart, assign a distinct color to each data point in the first dataset
          const backgroundColors = data.map((_, dataIndex) => pieColors[dataIndex % pieColors.length]);
          return {
            label: selectedYAxes[index].label,
            data,
            backgroundColor: backgroundColors,
            borderColor: backgroundColors.map(color => color.replace('0.8', '1')),
            borderWidth: 1,
          };
        }

        // For other chart types (bar, column3d, line, scatter)
        const colorIndex = index % gradientColorPairs.length;
        return {
          label: selectedYAxes[index].label,
          data,
          backgroundColor: (ctx) => {
            const chart = ctx.chart;
            const { ctx: canvasCtx, chartArea } = chart;
            return createGradient(canvasCtx, chartArea, gradientColorPairs[colorIndex].start, gradientColorPairs[colorIndex].end);
          },
          borderColor: gradientColorPairs[colorIndex].start.replace('0.8', '1'),
          borderWidth: selectedChart === 'pie' ? 1 : 2,
          fill: selectedChart === 'line' ? false : true,
          tension: selectedChart === 'line' ? 0.4 : undefined,
          pointRadius: selectedChart === 'scatter' ? 6 : 3,
          pointHoverRadius: 8,
          pointBackgroundColor: gradientColorPairs[colorIndex].start,
        };
      });

      // Check for invalid data
      const hasValidData = datasets.some((dataset) => dataset.data.some((value) => value != null));
      if (!hasValidData) {
        console.warn('No valid data points found:', datasets);
        toast.error('No valid data to display. Please check your data.');
        return null;
      }

      // Handle duplicate labels
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
    if (!chartRef.current) return;
    html2canvas(chartRef.current, { scale: 2 }).then((canvas) => {
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
    if (!chartRef.current) return;
    html2canvas(chartRef.current, { scale: 2 }).then((canvas) => {
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

    // Destroy existing chart instance if it exists
    if (chartInstanceRef.current) {
      try {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      } catch (error) {
        console.error('Error destroying chart instance:', error);
        ctx.clearRect(0, 0, chartRef.current.width, chartRef.current.height);
      }
    }

    const is3DColumn = selectedChart === 'column3d';
    const chartType = is3DColumn ? 'bar' : selectedChart; // Use 'bar' for column3d

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
              font: { size: 14, weight: 'bold', family: "'Inter', sans-serif" },
              color: '#1F2937',
              padding: 20,
              boxWidth: 20,
            },
          },
          title: {
            display: true,
            text: `${selectedChart === 'column3d' ? '3D Column' : selectedChart.charAt(0).toUpperCase() + selectedChart.slice(1)} Chart`,
            font: { size: 20, weight: 'bold', family: "'Inter', sans-serif" },
            color: '#1F2937',
            padding: { top: 10, bottom: 20 },
          },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            titleFont: { size: 14, weight: 'bold', family: "'Inter', sans-serif" },
            bodyFont: { size: 12, family: "'Inter', sans-serif" },
            padding: 12,
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
            display: selectedChart !== 'pie',
            color: '#1F2937',
            font: { size: 12, weight: 'bold', family: "'Inter', sans-serif" },
            formatter: (value) => (value != null ? formatNumber(value) : ''),
            padding: 6,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            borderRadius: 4,
            borderWidth: 1,
            borderColor: 'rgba(0, 0, 0, 0.1)',
            anchor: 'end',
            align: 'top',
            offset: 4,
          },
        },
        scales: selectedChart === 'pie' ? {} : {
          x: {
            title: {
              display: true,
              text: selectedXAxis.label,
              font: { size: 14, weight: 'bold', family: "'Inter', sans-serif" },
              color: '#1F2937',
              padding: { top: 10 },
            },
            grid: { display: false },
            ticks: {
              color: '#1F2937',
              font: { size: 10, family: "'Inter', sans-serif" },
              maxRotation: 45,
              minRotation: 45,
              padding: 10,
            },
          },
          y: {
            title: {
              display: true,
              text: selectedYAxes.length === 1 ? selectedYAxes[0].label : 'Values',
              font: { size: 14, weight: 'bold', family: "'Inter', sans-serif" },
              color: '#1F2937',
              padding: { bottom: 10 },
            },
            grid: { color: 'rgba(0, 0, 0, 0.05)', borderDash: [5, 5] },
            ticks: {
              color: '#1F2937',
              font: { size: 12, family: "'Inter', sans-serif" },
              callback: (value) => formatNumber(value),
            },
            beginAtZero: true,
          },
        },
        elements: {
          point: {
            radius: selectedChart === 'scatter' ? 6 : 3,
            hoverRadius: 8,
            hoverBorderWidth: 2,
          },
          line: {
            borderWidth: 3,
            tension: 0.4,
          },
          bar: {
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.8,
            categoryPercentage: 0.6,
            // Simulate 3D effect for column3d
            inflateAmount: is3DColumn ? 2 : 0, // Slight inflation for depth
            // Custom 3D styling via backgroundColor gradient already applied
          },
        },
        layout: {
          padding: 20,
        },
      },
    };

    // Helper function to format large numbers (e.g., 115000000 to "115M")
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
          font: { size: 14, weight: 'bold', family: "'Inter', sans-serif" },
          color: '#1F2937',
          padding: 20,
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
        font: { size: 12, weight: 'bold', family: "'Inter', sans-serif" },
        formatter: (value, ctx) => {
          const total = ctx.dataset.data.reduce((sum, val) => sum + (val || 0), 0);
          const percentage = ((value / total) * 100).toFixed(1);
          return value != null ? `${percentage}%` : '';
        },
        textAlign: 'center',
        padding: 4,
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

    // Add 3D effect for column3d chart using Chart.js plugin
    if (is3DColumn) {
      config.plugins = config.plugins || [];
      config.plugins.push({
        id: 'custom3D',
        afterDraw: (chart) => {
          const ctx = chart.ctx;
          chart.data.datasets.forEach((dataset, datasetIndex) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            meta.data.forEach((bar, index) => {
              const { x, y, width, height } = bar;
              // Simulate 3D shadow
              ctx.save();
              ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
              ctx.beginPath();
              ctx.rect(x, y + height, width, 5); // Bottom shadow
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
  }, [selectedChart, selectedXAxis, selectedYAxes, selectedFileData, isLoading]);

  return (
    <div className="mt-8 bg-white rounded-xl shadow-xl border border-gray-100 p-6 relative">
      <h3 className="text-xl font-semibold text-gray-900 mb-4">Chart Preview</h3>
      <div className="absolute top-6 right-6 flex space-x-2">
        <button
          onClick={downloadJPG}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
          </svg>
          JPG
        </button>
        <button
          onClick={downloadPDF}
          className="flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors duration-200 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          PDF
        </button>
      </div>
      <div className="relative" style={{ height: '600px' }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <svg
              className="animate-spin h-10 w-10 text-indigo-600"
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
          <canvas ref={chartRef} className="w-full h-full" />
        )}
      </div>
    </div>
  );
};

export default ChartGenerator;