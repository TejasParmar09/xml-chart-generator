import React, { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import toast from 'react-hot-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Register the datalabels plugin
Chart.register(ChartDataLabels);

const ChartGenerator = ({ selectedChart, selectedXAxis, selectedYAxes, selectedFileData, isLoading, is3DMode }) => {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const chartContainerRef = useRef(null);
  const threeContainerRef = useRef(null);
  const [aiInsights, setAiInsights] = useState(null);
  const [isFetchingInsights, setIsFetchingInsights] = useState(false);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);

  // Helper function to get the last part of a field path (flattened name)
  const getFlattenedFieldName = (path) => {
    if (!path) return null;
    const parts = path.split('.');
    return parts[parts.length - 1].toLowerCase();
  };

  // Create gradient fill for datasets in Chart.js
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
        { start: 'rgba(16, 185, 129, 0.9)', end: 'rgba(52, 211, 153, 0.5)' },
        { start: 'rgba(220, 60, 60, 0.9)', end: 'rgba(253, 113, 133, 0.5)' },
        { start: 'rgba(59, 130, 246, 0.9)', end: 'rgba(147, 197, 253, 0.5)' },
        { start: 'rgba(234, 179, 8, 0.9)', end: 'rgba(250, 252, 21, 0.5)' },
        { start: 'rgba(139, 75, 246, 0.9)', end: 'rgba(196, 181, 253, 0.5)' },
        { start: 'rgba(234, 88, 12, 0.9)', end: 'rgba(253, 146, 60, 0.5)' },
      ];

      const pieColors = [
        '#10B981', '#EF4444', '#3B82F6', '#EAB308', '#8B5CF6', '#EA580C',
        '#EC4899', '#14B8A6', '#F97316', '#A855F7', '#22C55E', '#0EA5E9',
      ];

      const scatterColors = [
        '#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#A133FF', '#FF8C33',
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
          connectorLines: data,
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
      } else if (selectedChart === 'scatter') {
        datasets = yFields.map((yField, index) => {
          const yFieldFlattened = yFieldsFlattened[index];
          const data = selectedFileData.map((item, itemIndex) => {
            let xValue = item[xFieldFlattened] ?? null;
            let yValue = item[yFieldFlattened] ?? null;
            if (xValue == null || yValue == null || isNaN(xValue) || isNaN(yValue)) {
              console.warn(`Invalid scatter data at item ${itemIndex}: x=${xValue}, y=${yValue}`);
              return null;
            }
            return { x: Number(xValue), y: Number(yValue) };
          }).filter(point => point != null);

          const colorIndex = index % scatterColors.length;
          return {
            label: selectedYAxes[index].label,
            data,
            backgroundColor: scatterColors[colorIndex],
            borderColor: scatterColors[colorIndex],
            borderWidth: 1,
            pointRadius: 8,
            pointHoverRadius: 12,
            showLine: false,
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

      const hasValidData = datasets.some((dataset) => dataset.data.length > 0 && dataset.data.some((value) => value != null || (value && (value.x != null && value.y != null))));
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
    if (is3DMode && (selectedChart === 'bar' || selectedChart === 'stackedbar')) {
      if (!rendererRef.current) return;
      const link = document.createElement('a');
      link.download = 'chart.jpg';
      link.href = rendererRef.current.domElement.toDataURL('image/jpeg', 1.0);
      link.click();
      toast.success('3D Chart downloaded as JPG!');
    } else {
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
    }
  };

  const downloadPDF = () => {
    if (is3DMode && (selectedChart === 'bar' || selectedChart === 'stackedbar')) {
      if (!rendererRef.current) return;
      const imgData = rendererRef.current.domElement.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 190;
      const imgHeight = (rendererRef.current.domElement.height * imgWidth) / rendererRef.current.domElement.width;
      pdf.addImage(imgData, 'JPEG', 10, 10, imgWidth, imgHeight);
      pdf.save('chart.pdf');
      toast.success('3D Chart downloaded as PDF!');
    } else {
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
    }
  };

  const fetchAIInsights = async () => {
    const chartData = prepareChartData();
    if (!chartData) {
      toast.error('No valid chart data to analyze.');
      return null;
    }

    setIsFetchingInsights(true);
    console.log('Starting AI insights generation for chart data:', chartData);

    try {
      const requestData = {
        chartType: selectedChart,
        xAxisLabel: selectedXAxis.label,
        yAxisLabels: selectedYAxes.map(yAxis => yAxis.label),
        labels: chartData.labels,
        datasets: chartData.datasets.map(dataset => ({
          label: dataset.label,
          data: dataset.data,
        })),
      };

      console.log('Request data for AI analysis:', requestData);
      const response = await mockAIAnalysis(requestData);
      console.log('AI insights response:', response);

      if (response && response.insights) {
        setAiInsights(response.insights);
        toast.success('AI insights generated successfully!');
        return response.insights; // Return insights for 3D chart use
      } else {
        throw new Error('No insights returned from AI analysis.');
      }
    } catch (error) {
      console.error('Error fetching AI insights:', error);
      toast.error('Failed to generate AI insights. Please try again.');
      setAiInsights(null);
      return null;
    } finally {
      setIsFetchingInsights(false);
      console.log('Finished AI insights generation. Current aiInsights state:', aiInsights);
    }
  };

  const mockAIAnalysis = async (chartData) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const insights = generateMockInsights(chartData);
        console.log('Generated mock insights:', insights);
        const highlights = extractHighlights(chartData);
        resolve({ insights, highlights });
      }, 1000);
    });
  };

  const extractHighlights = (chartData) => {
    const datasets = chartData.datasets;
    const highlights = [];

    datasets.forEach((dataset, datasetIndex) => {
      const values = dataset.data.filter(val => val != null);
      if (values.length === 0) return;

      const max = Math.max(...values);
      const min = Math.min(...values);
      const maxIndex = values.indexOf(max);
      const minIndex = values.indexOf(min);

      highlights.push({
        datasetIndex,
        maxIndex,
        minIndex,
        maxValue: max,
        minValue: min,
      });
    });

    return highlights;
  };

  const formatNumber = (value) => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toFixed(0);
  };

  const generateMockInsights = (chartData) => {
    const { chartType, xAxisLabel, yAxisLabels, labels, datasets } = chartData;

    let insights = `### AI Insights for Your ${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart\n\n`;

    insights += `#### Overview\nThis ${chartType} chart visualizes the relationship between **${xAxisLabel}** (X-axis) and the following datasets on the Y-axis:\n`;
    yAxisLabels.forEach((label, index) => {
      insights += `- **${label}** (Dataset ${index + 1})\n`;
    });
    insights += `The chart includes ${labels.length} categories: ${labels.join(', ')}.\n\n`;

    insights += `#### Dataset Analysis and Trends\n`;
    const allOutliers = [];
    datasets.forEach((dataset, index) => {
      const data = dataset.data.filter(val => val != null && (typeof val !== 'object' || (val.x != null && val.y != null)));
      const values = dataset.data.map(val => (typeof val === 'object' ? val.y : val)).filter(v => v != null);
      if (values.length === 0) {
        insights += `- **${dataset.label} (${yAxisLabels[index]})**: No valid data found.\n`;
        return;
      }

      const sum = values.reduce((acc, val) => acc + val, 0);
      const avg = sum / values.length;
      const max = Math.max(...values);
      const min = Math.min(...values);
      const maxIndex = values.indexOf(max);
      const minIndex = values.indexOf(min);

      insights += `- **${dataset.label} (${yAxisLabels[index]})**:\n`;
      insights += `  - **Total**: ${formatNumber(sum)}\n`;
      insights += `  - **Average**: ${formatNumber(avg)}\n`;
      insights += `  - **Highest Value**: ${formatNumber(max)} at ${labels[maxIndex]}\n`;
      insights += `  - **Lowest Value**: ${formatNumber(min)} at ${labels[minIndex]}\n`;

      let trend = 'stable';
      const diffs = values.slice(1).map((val, i) => val - values[i]);
      const increasing = diffs.every(diff => diff > 0);
      const decreasing = diffs.every(diff => diff < 0);
      if (increasing) trend = 'consistently increasing';
      else if (decreasing) trend = 'consistently decreasing';
      else if (diffs.some(diff => Math.abs(diff) > avg * 0.5)) trend = 'fluctuating significantly';

      insights += `  - **Trend**: The values for ${dataset.label} are ${trend} across the categories.\n`;

      const stdDev = Math.sqrt(values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length);
      const outliers = values
        .map((val, i) => ({ val, index: i }))
        .filter(({ val }) => Math.abs(val - avg) > 2 * stdDev);
      if (outliers.length > 0) {
        insights += `  - **Outliers**: Notable outliers detected at ${outliers.map(o => `${labels[o.index]} (${formatNumber(o.val)})`).join(', ')}.\n`;
        allOutliers.push(...outliers.map(o => ({ ...o, datasetLabel: dataset.label })));
      }
    });

    insights += `\n#### Chart-Specific Insights\n`;
    if (chartType === 'pie') {
      const total = datasets[0].data.reduce((sum, val) => sum + (val || 0), 0);
      const percentages = datasets[0].data.map(value => (value != null ? ((value / total) * 100).toFixed(1) : 0));
      const dominantIndex = percentages.indexOf(Math.max(...percentages));
      insights += `- **Distribution**: ${labels[dominantIndex]} dominates the ${yAxisLabels[0]} distribution, contributing ${percentages[dominantIndex]}% of the total.\n`;
      const smallestIndex = percentages.indexOf(Math.min(...percentages.filter(p => p > 0)));
      if (smallestIndex !== -1) {
        insights += `- **Smallest Share**: ${labels[smallestIndex]} has the smallest share at ${percentages[smallestIndex]}%.\n`;
      }
      insights += `- **Recommendation**: If ${yAxisLabels[0]} represents resource allocation (e.g., budget, time), consider rebalancing resources if the distribution is too skewed.\n`;
    } else if (chartType === 'waterfall') {
      const data = datasets[0].data;
      const cumulative = datasets[0].connectorLines.map(d => d.cumulative);
      const start = cumulative[0] || 0;
      const end = cumulative[cumulative.length - 1] || 0;
      const netChange = end - start;
      insights += `- **Net Change**: The ${yAxisLabels[0]} value changes by ${formatNumber(netChange)} from start to end, resulting in a final value of ${formatNumber(end)}.\n`;
      const largestChangeIndex = data.reduce((maxIndex, val, i, arr) => Math.abs(val) > Math.abs(arr[maxIndex]) ? i : maxIndex, 0);
      insights += `- **Largest Impact**: The largest change occurs at ${labels[largestChangeIndex]} with a ${data[largestChangeIndex] > 0 ? 'gain' : 'loss'} of ${formatNumber(Math.abs(data[largestChangeIndex]))}.\n`;
      insights += `- **Observation**: If negative changes are significant, it may indicate areas needing attention or cost-cutting measures.\n`;
    } else if (chartType === 'stackedbar') {
      const totals = labels.map((_, i) => datasets.reduce((sum, dataset) => sum + (dataset.data[i] || 0), 0));
      const maxTotal = Math.max(...totals);
      const maxIndex = totals.indexOf(maxTotal);
      const minTotal = Math.min(...totals);
      const minIndex = totals.indexOf(minTotal);
      insights += `- **Highest Combined Value**: ${labels[maxIndex]} has the highest combined ${yAxisLabels.join(' and ')} value of ${formatNumber(maxTotal)}.\n`;
      insights += `- **Lowest Combined Value**: ${labels[minIndex]} has the lowest combined value of ${formatNumber(minTotal)}.\n`;
      insights += `- **Insight**: The difference between ${labels[maxIndex]} and ${labels[minIndex]} (${formatNumber(maxTotal - minTotal)}) suggests significant variability. Investigate what drives this disparity.\n`;
    } else if (chartType === 'line' || chartType === 'area') {
      datasets.forEach((dataset, index) => {
        const data = dataset.data.filter(val => val != null);
        const diffs = data.slice(1).map((val, i) => val - data[i]);
        const peakIndex = data.indexOf(Math.max(...data));
        insights += `- **${dataset.label} (${yAxisLabels[index]}) Peak**: The highest value occurs at ${labels[peakIndex]} (${formatNumber(data[peakIndex])}).\n`;
        if (diffs.length > 0) {
          const volatility = diffs.reduce((acc, diff) => acc + Math.abs(diff), 0) / diffs.length;
          insights += `- **Volatility**: ${dataset.label} shows ${volatility > data.reduce((a, b) => a + b, 0) / data.length * 0.3 ? 'high' : 'low'} volatility with an average change of ${formatNumber(volatility)} between categories.\n`;
        }
      });
    } else if (chartType === 'radar') {
      datasets.forEach((dataset, index) => {
        const data = dataset.data.filter(val => val != null);
        const maxIndex = data.indexOf(Math.max(...data));
        const minIndex = data.indexOf(Math.min(...data));
        insights += `- **${dataset.label} (${yAxisLabels[index]}) Strength**: Strongest in ${labels[maxIndex]} (${formatNumber(data[maxIndex])}).\n`;
        insights += `- **Weakness**: Weakest in ${labels[minIndex]} (${formatNumber(data[minIndex])}).\n`;
        insights += `- **Balance Check**: The difference between ${labels[maxIndex]} and ${labels[minIndex]} (${formatNumber(data[maxIndex] - data[minIndex])}) indicates ${data[maxIndex] - data[minIndex] > data.reduce((a, b) => a + b, 0) / data.length ? 'an imbalance' : 'a balanced profile'} in ${dataset.label}.\n`;
      });
    } else if (chartType === 'scatter') {
      datasets.forEach((dataset, index) => {
        const data = dataset.data.filter(point => point != null && point.x != null && point.y != null);
        if (data.length === 0) return;
        const xValues = data.map(point => point.x);
        const yValues = data.map(point => point.y);
        const maxX = Math.max(...xValues);
        const minX = Math.min(...xValues);
        const maxY = Math.max(...yValues);
        const minY = Math.min(...yValues);
        insights += `- **${dataset.label} (${yAxisLabels[index]}) Range**:\n`;
        insights += `  - X-axis (${xAxisLabel}): From ${formatNumber(minX)} to ${formatNumber(maxX)}\n`;
        insights += `  - Y-axis (${yAxisLabels[index]}): From ${formatNumber(minY)} to ${formatNumber(maxY)}\n`;
      });
    }

    insights += `\n#### Additional Observations\n`;
    const allDataPoints = datasets.flatMap(dataset => {
      return dataset.data.map(val => (typeof val === 'object' ? val.y : val)).filter(v => v != null);
    });
    const avgAll = allDataPoints.reduce((a, b) => a + b, 0) / allDataPoints.length;
    const variance = allDataPoints.reduce((acc, val) => acc + Math.pow(val - avgAll, 2), 0) / allDataPoints.length;
    insights += `- **Data Consistency**: The data shows ${variance > avgAll * 0.5 ? 'high variability' : 'good consistency'} with a variance of ${formatNumber(variance)}. High variability might suggest diverse influences across categories.\n`;

    if (datasets.length > 1) {
      const data1 = datasets[0].data.map(val => (typeof val === 'object' ? val.y : val));
      const data2 = datasets[1].data.map(val => (typeof val === 'object' ? val.y : val));
      const correlation = calculateCorrelation(data1, data2);
      insights += `- **Correlation Between Datasets**: ${datasets[0].label} and ${datasets[1].label} have a correlation of ${correlation.toFixed(2)}. `;
      if (correlation > 0.7) insights += `This strong positive correlation suggests that as ${datasets[0].label} increases, ${datasets[1].label} tends to increase as well.\n`;
      else if (correlation < -0.7) insights += `This strong negative correlation indicates an inverse relationship between ${datasets[0].label} and ${datasets[1].label}.\n`;
      else insights += `There's little to no linear relationship between these datasets.\n`;
    }

    insights += `\n#### Recommendations\n`;
    if (chartType === 'pie') {
      const percentages = datasets[0].data.map(value => (value != null ? ((value / datasets[0].data.reduce((sum, val) => sum + (val || 0), 0)) * 100).toFixed(1) : 0));
      const dominantIndex = percentages.indexOf(Math.max(...percentages));
      if (percentages[dominantIndex] > 50) {
        insights += `- Consider diversifying resources or focus areas, as ${labels[dominantIndex]} accounts for over 50% of ${yAxisLabels[0]}.\n`;
      }
    }
    if (allOutliers.length > 0) {
      insights += `- Investigate the outliers at ${allOutliers.map(o => `${labels[o.index]} (Dataset: ${o.datasetLabel}, Value: ${formatNumber(o.val)})`).join(', ')} to understand potential anomalies or errors in the data.\n`;
    }
    if (datasets.length > 1 && Math.abs(correlation) > 0.7) {
      insights += `- Leverage the strong correlation between ${datasets[0].label} and ${datasets[1].label} for predictive modeling or strategic planning.\n`;
    }
    insights += `- To gain deeper insights, consider adding more contextual data, such as time trends or additional variables, if available.\n`;

    return insights || 'No insights could be generated for this chart.';
  };

  const calculateCorrelation = (data1, data2) => {
    const n = Math.min(data1.length, data2.length);
    if (n < 2) return 0;

    const validPairs = data1
      .map((val, i) => ({ x: val, y: data2[i] }))
      .filter(pair => pair.x != null && pair.y != null);

    if (validPairs.length < 2) return 0;

    const meanX = validPairs.reduce((sum, pair) => sum + pair.x, 0) / validPairs.length;
    const meanY = validPairs.reduce((sum, pair) => sum + pair.y, 0) / validPairs.length;

    const covariance = validPairs.reduce((sum, pair) => sum + (pair.x - meanX) * (pair.y - meanY), 0) / validPairs.length;
    const stdDevX = Math.sqrt(validPairs.reduce((sum, pair) => sum + Math.pow(pair.x - meanX, 2), 0) / validPairs.length);
    const stdDevY = Math.sqrt(validPairs.reduce((sum, pair) => sum + Math.pow(pair.y - meanY, 2), 0) / validPairs.length);

    if (stdDevX === 0 || stdDevY === 0) return 0;
    return covariance / (stdDevX * stdDevY);
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
                if (selectedChart === 'scatter') {
                  return `${context.dataset.label}: (X: ${formatNumber(value.x)}, Y: ${formatNumber(value.y)})`;
                }
                return `${context.dataset.label}: ${formatNumber(value)}`;
              },
            },
          },
          datalabels: {
            display: selectedChart !== 'pie' && selectedChart !== 'radar' && selectedChart !== 'scatter',
            color: '#1F2937',
            font: { size: 14, weight: 'bold', family: "'Inter', sans-serif" },
            formatter: (value, ctx) => {
              if (selectedChart === 'waterfall') {
                const data = ctx.dataset.connectorLines[ctx.dataIndex];
                return formatNumber(data.cumulative);
              }
              return value != null ? formatNumber(typeof value === 'object' ? value.y : value) : '';
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
            : selectedChart === 'scatter'
            ? {
                x: {
                  type: 'linear',
                  position: 'bottom',
                  title: {
                    display: true,
                    text: selectedXAxis.label,
                    font: { size: 16, weight: 'bold', family: "'Inter', sans-serif" },
                    color: '#1F2937',
                    padding: { top: 15, bottom: 10 },
                  },
                  grid: { display: true, color: 'rgba(0, 0, 0, 0.05)' },
                  ticks: {
                    color: '#1F2937',
                    font: { size: 14, family: "'Inter', sans-serif" },
                    callback: (value) => formatNumber(value),
                  },
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
                },
              }
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
            if (index === 0) return;

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
      config.options.elements.bar.borderColor = '#FFFFFF';
    }

    try {
      chartInstanceRef.current = new Chart(ctx, config);
    } catch (error) {
      console.error('Error creating chart:', error);
      toast.error('Failed to create chart. Please check the console for details.');
    }
  };

  const create3DChart = async (containerElement) => {
    // Ensure the passed containerElement is valid
    if (!containerElement) {
      console.error('Three.js container element is null or undefined.');
      return null; // Prevent further execution if element is null
    }

    const width = containerElement.clientWidth;
    const height = containerElement.clientHeight;

    if (width === 0 || height === 0) {
      console.warn('Three.js container has zero dimensions. Waiting for layout.', { width, height });
      return null; // Container not ready yet
    }

    console.log('threeContainerRef dimensions:', width, height);

    const chartData = prepareChartData();
    if (!chartData) return null; // Ensure chartData is available

    // Fetch AI insights for 3D chart highlights
    const aiAnalysis = await fetchAIInsights();
    const highlights = aiAnalysis?.highlights || [];

    // Cleanup previous Three.js scene
    if (sceneRef.current) {
      while (sceneRef.current.children.length > 0) {
        sceneRef.current.remove(sceneRef.current.children[0]);
      }
    }
    if (rendererRef.current) {
      rendererRef.current.domElement.remove();
      rendererRef.current.dispose();
    }

    // Initialize Three.js scene with better settings
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc); // Light gray background
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerElement.appendChild(renderer.domElement);
    console.log('Renderer DOM element appended:', containerElement.contains(renderer.domElement));

    // Store refs
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    // Enhanced lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    scene.add(directionalLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-5, 5, -5);
    scene.add(backLight);

    // Add OrbitControls with better settings
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.minDistance = 10;
    controls.maxDistance = 50;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1;
    controlsRef.current = controls;

    // Prepare data for 3D chart
    const labels = chartData.labels;
    const datasets = chartData.datasets;
    const maxValue = datasets.reduce((max, dataset) => {
      return Math.max(max, ...dataset.data.filter(v => v != null));
    }, 0);
    const numBars = labels.length;
    const barWidth = 0.6;
    const barDepth = 0.6;
    const spacing = 1.8;

    // Create a floor plane
    const floorGeometry = new THREE.PlaneGeometry(30, 30);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.8,
      metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    scene.add(floor);

    // Create bars with enhanced materials
    const barColors = [
      0x10B981, 0xEF4444, 0x3B82F6, 0xEAB308, 0x8B5CF6, 0xEA580C,
    ];

    let cumulativeHeights = new Array(numBars).fill(0);

    datasets.forEach((dataset, datasetIndex) => {
      const highlight = highlights.find(h => h.datasetIndex === datasetIndex) || {};
      const maxIndex = highlight.maxIndex;
      const minIndex = highlight.minIndex;

      dataset.data.forEach((value, index) => {
        if (value == null) return;

        const height = (value / maxValue) * 12; // Increased height for better visibility
        const xPosition = (index - (numBars - 1) / 2) * spacing;
        let yPosition = (selectedChart === 'stackedbar' ? cumulativeHeights[index] : 0) + height / 2;
        const zPosition = datasetIndex * (barDepth + 0.3) - (datasets.length - 1) * (barDepth + 0.3) / 2;

        // Enhanced bar material
        let color = barColors[datasetIndex % barColors.length];
        if (index === maxIndex) color = 0xFFD700;
        if (index === minIndex) color = 0xFF4500;

        const geometry = new THREE.BoxGeometry(barWidth, height, barDepth);
        const material = new THREE.MeshPhysicalMaterial({
          color: color,
          metalness: 0.3,
          roughness: 0.4,
          clearcoat: 0.5,
          clearcoatRoughness: 0.2,
          reflectivity: 0.5
        });
        const bar = new THREE.Mesh(geometry, material);
        bar.position.set(xPosition, yPosition, zPosition);
        bar.castShadow = true;
        bar.receiveShadow = true;
        scene.add(bar);

        // Add value label with improved visibility
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        context.font = 'bold 24px Arial';
        context.fillStyle = '#1F2937';
        context.textAlign = 'center';
        context.fillText(`${formatNumber(value)}`, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthTest: false
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(xPosition, yPosition + height / 2 + 0.5, zPosition);
        sprite.scale.set(2, 0.5, 1);
        scene.add(sprite);

        // Add category label
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 256;
        labelCanvas.height = 64;
        const labelContext = labelCanvas.getContext('2d');
        labelContext.font = 'bold 20px Arial';
        labelContext.fillStyle = '#1F2937';
        labelContext.textAlign = 'center';
        labelContext.fillText(labels[index], labelCanvas.width / 2, labelCanvas.height / 2);
        
        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        const labelSpriteMaterial = new THREE.SpriteMaterial({
          map: labelTexture,
          transparent: true,
          depthTest: false
        });
        const labelSprite = new THREE.Sprite(labelSpriteMaterial);
        labelSprite.position.set(xPosition, -0.5, zPosition);
        labelSprite.scale.set(2, 0.5, 1);
        scene.add(labelSprite);

        if (selectedChart === 'stackedbar') {
          cumulativeHeights[index] += height;
        }
      });
    });

    // Add axes with improved visibility
    const axesHelper = new THREE.AxesHelper(15);
    scene.add(axesHelper);

    // Add grid with better styling
    const gridHelper = new THREE.GridHelper(30, 30, 0x888888, 0xcccccc);
    gridHelper.position.y = -0.1;
    scene.add(gridHelper);

    // Position camera for better initial view
    camera.position.set(20, 20, 20);
    camera.lookAt(0, 0, 0);

    // Animation loop with smooth controls
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize with debouncing
    let resizeTimeout;
    const onResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const newWidth = containerElement.clientWidth;
        const newHeight = containerElement.clientHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
      }, 250);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimeout);
    };
  };

  useEffect(() => {
    if (isLoading) return;

    // Validate data after database operation
    if (!selectedFileData || selectedFileData.length === 0) {
      console.warn('No data available after database operation.');
      toast.error('No data available to render chart. Please upload a new file.');
      return;
    }

    let animationFrameId;
    let cleanup3DChart = null;

    // Decide whether to render 2D or 3D chart
    if (is3DMode && (selectedChart === 'bar' || selectedChart === 'stackedbar')) {
      // Cleanup 2D chart if it exists
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
      if (chartRef.current) {
        const ctx = chartRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, chartRef.current.width, chartRef.current.height);
        }
        chartRef.current.style.display = 'none';
      }

      // Show 3D container
      if (threeContainerRef.current) {
        threeContainerRef.current.style.display = 'block';
      }
      
      // Use requestAnimationFrame to ensure the DOM is ready
      animationFrameId = requestAnimationFrame(async () => {
        if (threeContainerRef.current) { // Ensure ref is still available before passing
          cleanup3DChart = await create3DChart(threeContainerRef.current);
        }
      });

    } else { // Render 2D chart
      // Cleanup 3D chart if it exists
      if (sceneRef.current) {
        while (sceneRef.current.children.length > 0) {
          sceneRef.current.remove(sceneRef.current.children[0]);
        }
      }
      if (rendererRef.current) {
        rendererRef.current.domElement.remove();
        rendererRef.current.dispose();
      }

      // Show 2D container
      if (threeContainerRef.current) {
        threeContainerRef.current.style.display = 'none';
      }
      if (chartRef.current) {
        chartRef.current.style.display = 'block';
      }
      createChart();
    }

    // Consolidated cleanup function for useEffect
    return () => {
      // Clean up requestAnimationFrame if it was scheduled
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      // Specific cleanup for 3D chart if it was successfully set up
      if (cleanup3DChart) {
        cleanup3DChart();
      }

      // General cleanup for both chart types
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.destroy();
          chartInstanceRef.current = null;
        } catch (error) {
          console.error('Error during chart.js cleanup:', error);
        }
      }
      if (sceneRef.current) {
        while (sceneRef.current.children.length > 0) {
          sceneRef.current.remove(sceneRef.current.children[0]);
        }
      }
      if (rendererRef.current) {
        rendererRef.current.domElement.remove();
        rendererRef.current.dispose();
      }
    };
  }, [selectedChart, selectedXAxis, selectedYAxes, selectedFileData, isLoading, is3DMode]);

  const handleCancelInsights = () => {
    setAiInsights(null);
  };

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
        {isLoading && (
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
        )}

        {/* Always render both, control visibility with display style */}
        <canvas ref={chartRef} className="w-full h-full" style={{ display: isLoading ? 'none' : 'block' }} />
        <div ref={threeContainerRef} className="w-full h-full" style={{ display: 'none' }}></div>
      </div>

      {/* AI Insight Button and Insights Display */}
      <div className="mt-6">
        <div className="flex justify-center space-x-4">
          <button
            onClick={fetchAIInsights}
            disabled={isFetchingInsights}
            className={`px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition duration-150 ease-in-out shadow-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${isFetchingInsights ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isFetchingInsights ? (
              <span className="flex items-center">
                <svg className="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating Insights...
              </span>
            ) : (
              'Get AI Insight'
            )}
          </button>
          {aiInsights && (
            <button
              onClick={handleCancelInsights}
              className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition duration-150 ease-in-out shadow-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Cancel
            </button>
          )}
        </div>

        {isFetchingInsights && (
          <div className="mt-6 text-center text-gray-500">
            <p>Loading AI insights...</p>
          </div>
        )}

        {aiInsights && !isFetchingInsights && (
          <div className="mt-6 bg-gray-50 p-6 rounded-lg shadow-inner">
            <h4 className="text-xl font-semibold text-gray-900 mb-4">AI-Generated Insights</h4>
            <pre className="text-gray-700 whitespace-pre-wrap">{aiInsights}</pre>
          </div>
        )}

        {!aiInsights && !isFetchingInsights && (
          <div className="mt-6 text-center text-gray-500">
            <p>Click "Get AI Insight" to generate insights for this chart.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChartGenerator;
