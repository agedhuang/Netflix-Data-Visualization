let table;
let sortedRows;
let minViews;
let maxViews;
const minRectWidth = 15; // 最小宽度
const maxRectWidth = 200; // 最大宽度，限制宽度差异在10倍以内
let netflixRed;
let genreColors;
let rectsInfo = [];

// Animation variables
let animationStartTime = 0;
let animationDuration = 2500; // 2.5 seconds for a smooth intro
let isIntroAnimationDone = false;

let dataProcessed = false;
let selectedMovieIndex = -1; // 当前选中的电影索引，-1表示未选中
let isOverviewMode = false; // 全局预览模式标志
let originalCanvasWidth = 0; // 保存原始Canvas宽度，用于退出预览模式时恢复
let originalCanvasHeight = 0; // 保存原始Canvas高度
let cachedTotalWidth = 0; // 缓存总宽度，避免重复计算
let cylinderRadius = 800; // 圆柱体半径（像素），越小透视效果越强
let cameraDistance = 1200; // 相机距离（像素），越小透视效果越强
let cylinderRotation = 0; // 圆柱体旋转角度（弧度），随滚动改变

// 不再使用离屏Canvas，直接绘制到主Canvas，使用CSS 3D transform

// 更新进度条
function updateProgress(percent, text = '') {
  const progressBar = document.querySelector('.progress-bar');
  if (progressBar) {
    progressBar.style.width = percent + '%';
    progressBar.style.transition = 'width 0.3s ease';
    progressBar.style.animation = 'none'; // 移除动画，使用实际进度
  }

  // 更新加载文字
  if (text) {
    const subtitle = document.querySelector('.loading-subtitle');
    if (subtitle) {
      subtitle.textContent = text;
    }
  }
}

function preload() {
  updateProgress(5, 'Loading CSV file...');
  table = loadTable('./finalForm.csv', 'csv', 'header');
  // CSV加载完成后，进度会在setup中继续更新
}

function setup() {
  // 创建画布，充满整个屏幕高度
  let canvasHeight = windowHeight; // 充满整个屏幕
  let canvas = createCanvas(windowWidth, canvasHeight);

  // 将Canvas放入容器中
  const container = document.getElementById('canvas-container');
  if (container) {
    canvas.parent(container);
  }
  canvas.position(0, 0); // 画布位置固定在顶部

  // 初始化颜色配置 - User Specified Palette
  genreColors = {
    'Action': color(255, 0, 50),        // 鲜艳红色
    'Comedy': color(0, 180, 255),       // 明亮青蓝色（改为蓝色）
    'Drama': color(0, 10, 80),          // 深蓝色
    'Romance': color(255, 0, 100),      // 鲜红色（减少粉色调）
    'Animation': color(50, 200, 255),   // 明亮天蓝色
    'Sci-Fi': color(0, 150, 255),       // 鲜艳蓝色
    'Horror': color(80, 0, 40),         // 深紫红色
    'Fantasy': color(100, 100, 255),    // 蓝紫色（更偏蓝）
    'Thriller': color(0, 0, 0),         // 纯黑色
    'Crime': color(180, 0, 30),         // 深红色（减少粉色）
    'Mystery': color(50, 50, 150),      // 深蓝紫色（更偏蓝）
    'Adventure': color(255, 80, 0),     // 橙红色
    'default': color(60, 60, 60)        // 深灰色
  };

  // 异步处理数据，显示真实进度
  print('Setup complete. Processing data...');
  updateProgress(10, 'Loading data...');

  // 延迟执行，确保loading界面已显示
  setTimeout(() => {
    processDataAsync();
  }, 100);

  // Netflix Intro Sequence Management
  // The CSS animation takes about 4 seconds total (3.5s duration + 0.5s delay)
  
  // Step 1: Make background transparent just before the zoom finishes (at 3.5s)
  // This reveals the canvas behind the "N" while it's still zooming
  setTimeout(() => {
    const introOverlay = document.getElementById('intro-overlay');
    if (introOverlay) {
      introOverlay.classList.add('transparent-bg');
      
      // Safari Fix: Aggressively remove all gradients and light effects
      
      // 1. Hide all brush effects (the "fur" gradients)
      const allBrushes = document.querySelectorAll('#intro-overlay .netflix-intro[letter=N] .effect-brush');
      allBrushes.forEach(brush => {
        brush.style.display = 'none';
        brush.style.opacity = '0'; // Double insurance
      });

      // 2. Remove background from helper-1 (the red container)
      const helper1 = document.querySelector('#intro-overlay .netflix-intro[letter=N] .helper-1');
      if (helper1) {
        helper1.style.backgroundColor = 'transparent';
        helper1.style.backgroundImage = 'none';
      }

      // 3. Remove shadow from helper-3
      const helper3 = document.querySelector('#intro-overlay .netflix-intro[letter=N] .helper-3');
      if (helper3) {
        helper3.style.boxShadow = 'none';
      }

      // 4. Ensure all generated bars are solid and flat
      const allBars = document.querySelectorAll('#intro-overlay .netflix-intro[letter=N] .effect-lumieres span');
      allBars.forEach(bar => {
        bar.style.boxShadow = 'none';
        bar.style.backgroundImage = 'none';
        // Force solid color if needed, but they should already be rgb()
      });
    }
  }, 3500);

  // Step 2: Fade out the entire overlay after the zoom is complete (at 4.5s)
  setTimeout(() => {
    const introOverlay = document.getElementById('intro-overlay');
    if (introOverlay) {
      introOverlay.classList.add('hidden');
      // Remove from display flow after transition to allow interaction with canvas
      setTimeout(() => {
        introOverlay.style.display = 'none';
        // Start auto-scroll ONLY after the intro is fully done (and overlay is removed)
        // Added extra delay as requested
        setTimeout(() => {
          startAutoScroll();
        }, 1000); 
      }, 800); // Matches the transition duration in CSS (0.8s)
    }
  }, 4500);
}

// Helper to convert p5 color to CSS string
function colorToCss(c) {
  return `rgba(${red(c)}, ${green(c)}, ${blue(c)}, ${alpha(c)/255})`;
}

// Removed updateIntroColors as it is replaced by generateIntroBars

// 异步处理数据，分步执行并更新进度
function processDataAsync() {
  updateProgress(20, 'Parsing CSV data...');

  if (!table) {
    print('ERROR: Table is not loaded!');
    updateProgress(100, 'Error loading data');
    return;
  }

  let rows = table.getRows();
  print(`Total rows loaded: ${rows.length}`);

  updateProgress(30, 'Sorting movies by year...');

  // 使用requestAnimationFrame分帧排序（如果数据量大）
  if (rows.length > 1000) {
    // 大数据集：分步排序
    setTimeout(() => {
      rows.sort((a, b) => {
        const yearA = a.getNum('startYear');
        const yearB = b.getNum('startYear');
        return yearA - yearB;
      });
      sortedRows = rows;
      continueProcessing();
    }, 0);
  } else {
    // 小数据集：直接排序
    rows.sort((a, b) => {
      const yearA = a.getNum('startYear');
      const yearB = b.getNum('startYear');
      return yearA - yearB;
    });
    sortedRows = rows;
    continueProcessing();
  }
}

function continueProcessing() {
  updateProgress(40, 'Calculating views ranges...');

  minViews = Infinity;
  maxViews = -Infinity;

  // Find min and max views - 优化：只遍历一次
  for (let i = 0; i < sortedRows.length; i++) {
    let viewsStr = sortedRows[i].getString('Views');
    let views = parseFloat(viewsStr);

    if (!isNaN(views) && views > 0) {
      if (views < minViews) {
        minViews = views;
      }
      if (views > maxViews) {
        maxViews = views;
      }
    }
  }

  print(`min views: ${minViews}, max views: ${maxViews}`);

  updateProgress(60, 'Calculating canvas dimensions...');

  // Calculate total width and populate rectsInfo
  calculateMainLayout();
  
  // Calculate total width for spacer
  let totalWidth = 0;
  if (rectsInfo.length > 0) {
    const lastRect = rectsInfo[rectsInfo.length - 1];
    totalWidth = lastRect.x + lastRect.w;
  }
  
  print(`Total width calculated: ${totalWidth}px`);
  print(`Total movies: ${sortedRows.length}`);

  updateProgress(80, 'Resizing canvas...');

  // Resize canvas to window size (avoid giant canvas crash)
  let canvasHeight = windowHeight;
  pixelDensity(1); 
  resizeCanvas(windowWidth, canvasHeight);

  // Create spacer for scrolling
  const container = document.getElementById('canvas-container');
  let spacer = document.getElementById('scroll-spacer');
  if (!spacer) {
    spacer = document.createElement('div');
    spacer.id = 'scroll-spacer';
    container.appendChild(spacer);
  }
  spacer.style.width = totalWidth + 'px';
  spacer.style.height = '1px';
  
  // Set canvas to sticky so it stays in view
  const canvas = document.querySelector('canvas');
  if (canvas) {
    canvas.style.position = 'sticky';
    canvas.style.left = '0';
    canvas.style.top = '0';
    print(`Canvas set to sticky, size: ${windowWidth}x${windowHeight}`);
  }
  // 保存原始Canvas尺寸
  originalCanvasWidth = totalWidth;
  originalCanvasHeight = canvasHeight;

  print(`Total movies: ${sortedRows.length}`);
  print(`Canvas resized to: ${totalWidth}x${canvasHeight}`);

  updateProgress(90, 'Preparing visualization...');

  dataProcessed = true;
  print('Data processing complete!');
  
  // Start intro animation
  animationStartTime = millis();
  isIntroAnimationDone = false;

  // 初始化HTML指示线的拖拽功能
  initIndicatorLine();

  // 初始化底部信息栏的收起/展开功能
  initBottomBarToggle();

  // 初始化全局预览切换功能
  initOverviewToggle();

  updateProgress(95, 'Finalizing...');

  // 设置滚动监听
  setupScrollListener();

  // Generate intro bars to match data layout
  generateIntroBars();

  updateProgress(100, 'Complete!');
}

// Generate intro bars to match the visualization layout
function generateIntroBars() {
  if (!rectsInfo || rectsInfo.length === 0) return;

  const helper1 = document.querySelector('#intro-overlay .netflix-intro[letter=N] .helper-1');
  if (!helper1) return;

  // Remove box-shadow from helper-3 (which has a shadow in CSS)
  const helper3 = document.querySelector('#intro-overlay .netflix-intro[letter=N] .helper-3');
  if (helper3) {
    helper3.style.boxShadow = 'none';
  }

  // Find the effect-lumieres container
  let lumieres = helper1.querySelector('.effect-lumieres');
  if (!lumieres) {
    lumieres = document.createElement('div');
    lumieres.className = 'effect-lumieres';
    helper1.appendChild(lumieres);
  }
  
  // Ensure the container itself has no shadows or gradients
  lumieres.style.boxShadow = 'none';
  lumieres.style.backgroundImage = 'none';

  // Clear existing lamps
  lumieres.innerHTML = '';

  // Calculate layout parameters
  // Use computed style for exact width to ensure alignment
  const computedStyle = window.getComputedStyle(helper1);
  const helperBaseWidth = parseFloat(computedStyle.width) || (300 * 0.195);
  const scale = 60;
  const screenWidth = windowWidth;
  
  // We want the visualization (starting at x=0) to align with the left edge of the screen
  // The CSS animation aligns the Left Edge of Helper-1 with the Left Edge of the Screen.
  
  // In Helper Internal Coordinates (Rotated 180deg):
  // Visual Left = Internal Right
  // Visual Right = Internal Left
  
  // So Visual Left of Screen (x=0) corresponds to Internal Right Edge of Helper-1.
  // Internal Right Edge is at x = helperBaseWidth.
  
  let currentInternalRight = helperBaseWidth;
  
  // Iterate through rectsInfo until we fill the container capacity
  // rectsInfo is already sorted by x position
  
  // Calculate max width to fill the helper container completely
  // helperBaseWidth is the width of the container in pixels
  // scale is the compression factor (60)
  // So we need to generate bars for up to helperBaseWidth * scale visual pixels
  const maxVisualWidth = helperBaseWidth * scale;

  for (let i = 0; i < rectsInfo.length; i++) {
    const rect = rectsInfo[i];
    
    // If this bar is beyond the container capacity, we can stop
    if (rect.x > maxVisualWidth) break;
    
    // Calculate internal width
    const internalWidth = rect.w / scale;
    
    // Calculate internal left position
    // The element extends from currentInternalRight towards the left (internally)
    // So left = currentInternalRight - (VisualRight / scale)
    // VisualRight = rect.x + rect.w
    
    // FIX: Ensure precise alignment by using floating point values directly
    // and accounting for any potential sub-pixel rendering issues.
    // The logic: internalLeft = helperBaseWidth - (rect.x + rect.w) / scale
    // This assumes helperBaseWidth corresponds to x=0.
    
    const internalLeft = currentInternalRight - (rect.x + rect.w) / scale;
    
    // Get color
    const c = rect.color;
    const cssColor = `rgb(${red(c)}, ${green(c)}, ${blue(c)})`; // Solid color, no alpha
    
    // Create lamp element (Use div for better consistency)
    const bar = document.createElement('div');
    
    // Apply styles
    bar.style.position = 'absolute';
    bar.style.left = internalLeft + 'px';
    bar.style.width = internalWidth + 'px'; 
    bar.style.height = '100%';
    bar.style.backgroundColor = cssColor;
    bar.style.zIndex = '10'; // Ensure it's visible
    bar.style.opacity = '1'; 
    
    // Ensure no shadows or gradients on these elements - use !important to be sure
    bar.style.setProperty('box-shadow', 'none', 'important');
    bar.style.setProperty('background-image', 'none', 'important');
    bar.style.setProperty('border', 'none', 'important');
    bar.style.setProperty('outline', 'none', 'important');
    
    bar.className = ''; // Ensure no class is added that might bring in CSS shadows
    
    lumieres.appendChild(bar);
  }
}

// 旧的处理函数已移除，改用processDataAsync()

let firstDraw = true; // 标记是否是第一次绘制
let lastScrollLeft = -1; // 记录上次滚动位置

function draw() {
  // 数据处理完成后，绘制可视化内容
  if (dataProcessed && sortedRows) {
    // 如果是预览模式，绘制预览版本（只绘制一次，不循环）
    if (isOverviewMode) {
      if (firstDraw || !firstDraw) {
        // 总是绘制
        drawOverviewMode();
        noLoop(); // 绘制完成后停止循环，避免卡顿
      }
      return;
    }

    if (firstDraw) {
      updateProgress(98, 'Rendering canvas...');

      // 立即隐藏loading，不等待任何操作（必须在最前面）
      print('Hiding loading overlay immediately...');
      updateProgress(100, 'Complete!');
      const loadingOverlay = document.getElementById('loading-overlay');
      if (loadingOverlay) {
        // 立即隐藏，不等待CSS动画
        loadingOverlay.style.display = 'none';
        loadingOverlay.style.visibility = 'hidden';
        loadingOverlay.style.opacity = '0';
        loadingOverlay.classList.add('hidden');
        setTimeout(() => {
          loadingOverlay.remove();
          print('Loading overlay removed');
        }, 100); // 缩短延迟
      } else {
        print('Warning: Loading overlay not found!');
      }

      // 直接在draw()循环中绘制，而不是在异步函数中
      // 这样可以确保p5.js不会清空canvas
      print('Starting canvas draw in draw() loop...');
      firstDraw = false;
      // 不调用noLoop()，让draw()继续运行直到绘制完成
    }
    
    // 在draw()循环中直接绘制（确保p5.js不会清空canvas）
    if (!firstDraw) {
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sketch.js:268',message:'About to draw in draw() loop',data:{firstDraw:firstDraw,canvasWidth:width,canvasHeight:height},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
      // #endregion
      
      // 确保canvas可见，并且不在draw()中调用background()，让drawFlatCanvasInDrawLoop()自己处理
      const canvas = document.querySelector('canvas');
      if (canvas) {
        canvas.style.display = 'block';
        canvas.style.visibility = 'visible';
        canvas.style.opacity = '1';
        canvas.style.zIndex = '1';
      }
      
      drawFlatCanvasInDrawLoop();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sketch.js:275',message:'After drawFlatCanvasInDrawLoop, calling noLoop()',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
      // #endregion
      
      if (isIntroAnimationDone) {
        noLoop(); // 绘制完成后停止循环
      }
      
      // #region agent log
      // 延迟检查，看draw()是否继续运行并清空canvas
      setTimeout(() => {
        try {
          const canvas = document.querySelector('canvas');
          if (canvas) {
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, Math.min(100, canvas.width), Math.min(100, canvas.height));
            let hasNonBlackPixels = false;
            for (let idx = 0; idx < imageData.data.length; idx += 4) {
              if (imageData.data[idx] > 0 || imageData.data[idx + 1] > 0 || imageData.data[idx + 2] > 0) {
                hasNonBlackPixels = true;
                break;
              }
            }
            fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sketch.js:290',message:'Delayed canvas check after noLoop()',data:{hasNonBlackPixels:hasNonBlackPixels,canvasWidth:canvas.width,canvasHeight:canvas.height},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
          }
        } catch (e) {
          fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sketch.js:300',message:'Delayed canvas check error',data:{error:e.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
        }
      }, 100);
      // #endregion
    }
  }
}

// 监听滚动事件，触发重绘
function setupScrollListener() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  let scrollTimeout;
  let lastScroll = 0;

  container.addEventListener(
    'scroll',
    () => {
      // 获取最新滚动位置
      let currentScroll = container.scrollLeft || 0;

      // 只在滚动位置改变超过1像素时重绘（减少重绘频率）
      if (Math.abs(currentScroll - lastScroll) > 1) {
        lastScroll = currentScroll;

        // Trigger redraw to update visible area
        redraw();
      }
    },
    { passive: true }
  );
}

// 绘制最终可视化内容的函数
function drawVisualization() {
  // 每次重绘时清空背景
  background('black');

  rectsInfo = [];

  // 每次重绘时都重新获取最新的滚动位置和视窗宽度（关键！）
  const container = document.getElementById('canvas-container');
  let scrollLeft = 0;
  // 使用实际的视窗宽度（浏览器窗口宽度）
  let viewportWidth = window.innerWidth || windowWidth;
  if (container) {
    // 重新获取最新的滚动位置
    scrollLeft = container.scrollLeft || 0;
  }

  // 计算可见区域范围（左右各扩展30%以减少绘制数量，提升性能）
  let visibleStart = scrollLeft - viewportWidth * 0.3;
  let visibleEnd = scrollLeft + viewportWidth * 1.3;

  // 计算视窗中心在Canvas中的位置（每次重绘时重新计算）
  let viewportCenterX = scrollLeft + viewportWidth / 2;

  // 增强光效设置
  drawingContext.shadowBlur = 0; // Disable shadow for flat look and better Safari performance
  drawingContext.shadowOffsetX = 0; // 无水平偏移
  drawingContext.shadowOffsetY = 0; // 无垂直偏移

  strokeWeight(0);

  let currentX = 0; // 从画布左边开始绘制
  let drawnCount = 0; // 记录实际绘制的矩形数量

  for (let i = 0; i < sortedRows.length; i++) {
    let viewsStr = sortedRows[i].getString('Views');
    let views = parseFloat(viewsStr);

    // Set fill color based on genre
    let genresStr = sortedRows[i].getString('genres');
    let genres = [];
    if (genresStr) {
      genres = genresStr.split(',').map((g) => g.trim());
    }

    let blendedColor;
    if (genres.length === 0 || !genresStr) {
      blendedColor = genreColors['default'];
    } else if (genres.length === 1) {
      blendedColor = genreColors[genres[0]] || genreColors['default'];
    } else {
      // 混合多个类型的颜色
      let totalR = 0,
        totalG = 0,
        totalB = 0;
      let hasDarkColor = false;
      let validGenres = 0;

      for (const genre of genres) {
        const c = genreColors[genre] || genreColors.default;
        if (c) {
          totalR += red(c);
          totalG += green(c);
          totalB += blue(c);
          validGenres++;

          // 计算亮度
          let brightness = (red(c) + green(c) + blue(c)) / 3;
          // 检查是否包含暗色（Drama, Horror, Thriller）
          if (brightness < 60) {
            hasDarkColor = true;
          }
        }
      }

      // 如果没有有效的 genre，使用默认颜色
      if (validGenres === 0) {
        blendedColor = genreColors['default'];
      } else {
        // 平均混合
        let avgR = totalR / validGenres;
        let avgG = totalG / validGenres;
        let avgB = totalB / validGenres;

        // 如果包含暗色，压得更暗
        if (hasDarkColor) {
          let currentBrightness = (avgR + avgG + avgB) / 3;
          // 大幅降低亮度
          if (currentBrightness > 50) {
            let darkenFactor = 50 / currentBrightness;
            avgR *= darkenFactor;
            avgG *= darkenFactor;
            avgB *= darkenFactor;
          }
          // 再额外压暗 20%
          avgR *= 0.8;
          avgG *= 0.8;
          avgB *= 0.8;
        } else {
          // 如果都是亮色，大幅提升亮度和饱和度
          let currentBrightness = (avgR + avgG + avgB) / 3;

          // 提升亮度 50%
          let brightenFactor = 1.5;
          avgR = min(avgR * brightenFactor, 255);
          avgG = min(avgG * brightenFactor, 255);
          avgB = min(avgB * brightenFactor, 255);

          // 增强饱和度：找到最大和最小的 RGB 值，拉大差距
          let maxVal = max(avgR, avgG, avgB);
          let minVal = min(avgR, avgG, avgB);

          if (maxVal > 0) {
            // 让最大值更接近 255，最小值更接近 0
            avgR = map(avgR, minVal, maxVal, minVal * 0.5, min(maxVal * 1.2, 255));
            avgG = map(avgG, minVal, maxVal, minVal * 0.5, min(maxVal * 1.2, 255));
            avgB = map(avgB, minVal, maxVal, minVal * 0.5, min(maxVal * 1.2, 255));
          }
        }

        blendedColor = color(avgR, avgG, avgB);
      }
    }

    // 暂时注释掉Netflix红色混合，使用纯色
    // const lerpAmount = 0.4;
    // const finalColor = lerpColor(blendedColor, netflixRed, lerpAmount);
    let finalColor = blendedColor; // 直接使用原始混合色

    // 验证 finalColor 是否有效
    if (!finalColor || isNaN(red(finalColor)) || isNaN(green(finalColor)) || isNaN(blue(finalColor))) {
      print(`Warning: Invalid color for movie ${i}, using default`);
      finalColor = genreColors['default'];
    }

    drawingContext.shadowColor = finalColor;

    fill(finalColor);

    //Compute width based on views (使用平方根映射让宽度更均匀)
    if (!isNaN(views) && views > 0) {
      // 使用平方根映射来压缩大值，让宽度差异更小
      let normalizedViews = (views - minViews) / (maxViews - minViews);
      normalizedViews = sqrt(normalizedViews);
      let rectWidth = map(normalizedViews, 0, 1, minRectWidth, maxRectWidth);

      // 性能优化：只绘制可见区域附近的矩形
      let rectEndX = currentX + rectWidth;
      if (rectEndX < visibleStart || currentX > visibleEnd) {
        // 矩形不在可见区域内，跳过绘制，但仍需更新currentX和保存信息用于查找
        // 保存原始位置信息（用于查找功能）
        rectsInfo.push({
          x: currentX,
          y: 0,
          w: rectWidth,
          h: height,
          row: sortedRows[i],
          color: finalColor,
          originalX: currentX,
          originalW: rectWidth,
        });
        currentX += rectWidth;
        continue;
      }

      // 计算3D圆柱体效果
      // viewportCenterX已在函数开头计算（使用最新的滚动位置）

      // 计算矩形中心在Canvas中的位置
      let rectCenterX = currentX + rectWidth / 2;

      // 计算矩形中心相对于视窗中心的位置
      // viewportCenterX是视窗中心在Canvas中的位置（随滚动变化）
      // rectCenterX是矩形中心在Canvas中的位置
      let offsetFromViewportCenter = rectCenterX - viewportCenterX;
      let distanceFromViewportCenter = abs(offsetFromViewportCenter);

      // 计算归一化的距离（0到1之间，0是视窗中心，1是视窗边缘）
      // 使用视窗宽度的一半作为参考
      let maxDistance = viewportWidth / 2;
      let normalizedDistance = 0;

      // 确保计算正确：如果距离为0（在视窗中心），normalizedDistance应该是0
      if (maxDistance > 0) {
        normalizedDistance = min(distanceFromViewportCenter / maxDistance, 1.0);
      }

      // 计算透视缩放：中间最大（scale = 1.0），两边变小
      // normalizedDistance: 0(中心) -> 1(边缘)
      // scale: 1.0(中心) -> 最小值(边缘)
      // 使用cos函数创建更平滑的过渡
      let heightScale = 1.0 - perspectiveStrength * (1 - cos((normalizedDistance * PI) / 2));
      heightScale = max(heightScale, 0.3); // 最小缩放30%

      // 确保视窗中心的矩形高度最大（容错处理）
      // 如果距离视窗中心非常近（< 2像素），强制heightScale = 1.0
      if (distanceFromViewportCenter < 2) {
        heightScale = 1.0;
        normalizedDistance = 0;
      }

      // 宽度也随透视缩放，增强3D效果
      let widthScale = 1.0 - perspectiveStrength * widthScaleFactor * (1 - cos((normalizedDistance * PI) / 2));
      widthScale = max(widthScale, 0.5); // 宽度最小缩放50%

      // 计算Y位置偏移（模拟圆柱体的弯曲）
      // 中间应该最高（Y偏移最小），两边应该向下（Y偏移增大）
      // 使用二次函数：中间为0，两边逐渐增大
      let yOffset = normalizedDistance * normalizedDistance * cylinderCurvature * height * 0.3;
      // 确保中间最高，两边对称向下

      // 计算亮度变化（模拟光照效果）：中间最亮，两边变暗
      // 基于距离中心的位置，中间最亮
      let brightnessFactor = 1.0 - 0.3 * normalizedDistance; // 1.0(中心) -> 0.7(边缘)

      // 保存当前变换状态
      drawingContext.save();

      // 应用3D变换
      // 先移动到矩形中心
      drawingContext.translate(rectCenterX, height / 2);
      // 应用缩放（宽度和高度都缩放）
      drawingContext.scale(widthScale, heightScale);
      // 应用Y偏移
      drawingContext.translate(0, yOffset);
      // 移回原点
      drawingContext.translate(-rectCenterX, -height / 2);

      // 根据位置调整颜色亮度（模拟光照）
      let r = red(finalColor);
      let g = green(finalColor);
      let b = blue(finalColor);

      // 应用亮度变化
      r = min(r * brightnessFactor, 255);
      g = min(g * brightnessFactor, 255);
      b = min(b * brightnessFactor, 255);

      let adjustedColor = color(r, g, b);

      // 使用调整后的颜色
      drawingContext.shadowBlur = 0; // Disable shadow for performance
      drawingContext.shadowColor = adjustedColor;

      fill(adjustedColor);

      // 计算变换后的矩形参数
      let scaledHeight = height * heightScale;
      let scaledWidth = rectWidth * widthScale;
      let rectX = currentX + (rectWidth - scaledWidth) / 2; // 居中
      let rectY = (height - scaledHeight) / 2 + yOffset;

      // 绘制矩形
      rect(rectX, rectY, scaledWidth, scaledHeight);

      // 恢复变换状态
      drawingContext.restore();

      // 保存矩形信息（使用原始位置，用于点击检测）
      rectsInfo.push({
        x: rectX, // 使用变换后的X位置
        y: rectY,
        w: scaledWidth, // 使用变换后的宽度
        h: scaledHeight,
        row: sortedRows[i],
        color: finalColor, // 保存原始颜色信息
        originalX: currentX, // 保存原始X位置用于查找
        originalW: rectWidth, // 保存原始宽度用于查找
      });

      currentX += rectWidth; // Update x position for next rectangle
      drawnCount++; // 增加计数
    }
  }

  // 重置光效设置
  drawingContext.shadowBlur = 0;
}

// 在draw()循环中直接绘制（完全使用p5.js API，不混用原生Canvas API）
function drawFlatCanvasInDrawLoop() {
  if (!rectsInfo || rectsInfo.length === 0) {
    return;
  }
  
  // Get scroll position
  const container = document.getElementById('canvas-container');
  let scrollLeft = 0;
  if (container) {
    scrollLeft = container.scrollLeft || 0;
  }
  
  // Clear canvas
  background(0);
  noStroke();
  
  // Translate context
  push();
  translate(-scrollLeft, 0);
  
  // Draw visible rects
  let drawnCount = 0;
  let viewportWidth = width; // Canvas width (windowWidth)
  
  // Define visible range in "world" coordinates
  let visibleStart = scrollLeft;
  let visibleEnd = scrollLeft + viewportWidth;
  
  // Add buffer to avoid flickering at edges
  visibleStart -= 100;
  visibleEnd += 100;
  
  // Use native context for gradient performance
  let ctx = drawingContext;

  // Calculate animation progress
  let progress = 1;
  if (!isIntroAnimationDone) {
    let elapsed = millis() - animationStartTime;
    progress = elapsed / animationDuration;
    
    if (progress >= 1) {
      progress = 1;
      isIntroAnimationDone = true;
    } else {
      // EaseOutExpo: 1 - pow(2, -10 * x)
      progress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    }
  }

  for (let i = 0; i < rectsInfo.length; i++) {
    let r = rectsInfo[i];
    
    // Check visibility
    if (r.x + r.w > visibleStart && r.x < visibleEnd) {
      fill(r.color);
      
      if (progress < 1) {
        // Animation: Expand from center vertically
        let currentHeight = height * progress;
        let startY = (height - currentHeight) / 2;
        rect(r.x, startY, r.w, currentHeight);
      } else {
        // Static full height
        rect(r.x, 0, r.w, height);
      }
      
      drawnCount++;
    }
  }
  
  pop();
  
  // 确保canvas可见（使用DOM操作，但不混用Canvas API）
  const canvasElement = document.querySelector('canvas');
  if (canvasElement) {
    canvasElement.style.display = 'block';
    canvasElement.style.visibility = 'visible';
    canvasElement.style.zIndex = '1';
  }
}

// 异步绘制平面版本到主Canvas（分帧处理，避免阻塞）- 已废弃，改用drawFlatCanvasInDrawLoop
let isDrawing = false; // 防止重复绘制
function drawFlatCanvasToMainAsync() {
  if (!sortedRows) {
    // 数据未加载完成，稍后重试
    return;
  }

  // 防止重复调用
  if (isDrawing) {
    print('Warning: drawFlatCanvasToMainAsync already in progress, skipping');
    return;
  }
  isDrawing = true;

  // 获取Canvas元素和context（确保使用正确的context）
  const canvas = document.querySelector('canvas');
  if (!canvas) {
    print('ERROR: Canvas not found!');
    isDrawing = false;
    return;
  }

  // 尝试使用p5.js的drawingContext，而不是原生context（可能p5.js管理了context状态）
  // 先尝试p5.js的drawingContext
  let ctx = null;
  try {
    ctx = drawingContext;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sketch.js:609',message:'Using p5.js drawingContext',data:{hasDrawingContext:!!drawingContext,canvasWidth:canvas.width,canvasHeight:canvas.height},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
  } catch (e) {
    // 如果p5.js的drawingContext不可用，使用原生context
    ctx = canvas.getContext('2d');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sketch.js:615',message:'Falling back to native context',data:{error:e.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
  }
  
  if (!ctx) {
    print('ERROR: Cannot get 2D context!');
    isDrawing = false;
    return;
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sketch.js:620',message:'Canvas context obtained',data:{canvasWidth:canvas.width,canvasHeight:canvas.height,contextType:ctx.constructor.name,fillStyle:ctx.fillStyle,globalCompositeOperation:ctx.globalCompositeOperation,isP5Context:ctx===drawingContext},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion

  // 调试：检查Canvas尺寸
  print(`Canvas dimensions: canvas.width=${canvas.width}, canvas.height=${canvas.height}, p5 width=${width}, p5 height=${height}`);

  // 清空主Canvas - 使用p5.js的background()函数，确保与p5.js兼容
  background(0); // 使用p5.js的background()，而不是直接操作context
  strokeWeight(0);
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sketch.js:625',message:'Canvas cleared using p5.js background()',data:{canvasWidth:canvas.width,canvasHeight:canvas.height},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  // #endregion

  // 设置阴影效果（临时禁用，避免Chrome兼容性问题）
  // ctx.shadowBlur = 20;
  // ctx.shadowOffsetX = 0;
  // ctx.shadowOffsetY = 0;

  let currentX = 0;
  let i = 0;
  const batchSize = 200; // 每帧绘制200个矩形，减少帧数

  function drawBatch() {
    const end = Math.min(i + batchSize, sortedRows.length);

    // 调试：记录绘制进度
    if (i === 0) {
      print(`Starting drawBatch: totalRows=${sortedRows.length}, batchSize=${batchSize}, canvasWidth=${width}, canvasHeight=${height}`);
      fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:592', message: 'Starting drawBatch', data: { totalRows: sortedRows.length, batchSize, canvasWidth: width, canvasHeight: height }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E' }) }).catch(() => {});
    }

    for (; i < end; i++) {
      let viewsStr = sortedRows[i].getString('Views');
      let views = parseFloat(viewsStr);

      // 获取颜色
      let genresStr = sortedRows[i].getString('genres');
      let genres = [];
      if (genresStr) {
        genres = genresStr.split(',').map((g) => g.trim());
      }

      let blendedColor;
      if (genres.length === 0 || !genresStr) {
        blendedColor = genreColors['default'];
      } else if (genres.length === 1) {
        blendedColor = genreColors[genres[0]] || genreColors['default'];
      } else {
        // 混合多个类型的颜色（简化版，复用之前的逻辑）
        let totalR = 0,
          totalG = 0,
          totalB = 0;
        let hasDarkColor = false;
        let validGenres = 0;

        for (const genre of genres) {
          const c = genreColors[genre] || genreColors.default;
          if (c) {
            totalR += red(c);
            totalG += green(c);
            totalB += blue(c);
            validGenres++;

            let brightness = (red(c) + green(c) + blue(c)) / 3;
            if (brightness < 60) {
              hasDarkColor = true;
            }
          }
        }

        if (validGenres === 0) {
          blendedColor = genreColors['default'];
        } else {
          let avgR = totalR / validGenres;
          let avgG = totalG / validGenres;
          let avgB = totalB / validGenres;

          if (hasDarkColor) {
            let currentBrightness = (avgR + avgG + avgB) / 3;
            if (currentBrightness > 50) {
              let darkenFactor = 50 / currentBrightness;
              avgR *= darkenFactor;
              avgG *= darkenFactor;
              avgB *= darkenFactor;
            }
            avgR *= 0.8;
            avgG *= 0.8;
            avgB *= 0.8;
          } else {
            let brightenFactor = 1.5;
            avgR = min(avgR * brightenFactor, 255);
            avgG = min(avgG * brightenFactor, 255);
            avgB = min(avgB * brightenFactor, 255);

            let maxVal = max(avgR, avgG, avgB);
            let minVal = min(avgR, avgG, avgB);

            if (maxVal > 0) {
              avgR = map(avgR, minVal, maxVal, minVal * 0.5, min(maxVal * 1.2, 255));
              avgG = map(avgG, minVal, maxVal, minVal * 0.5, min(maxVal * 1.2, 255));
              avgB = map(avgB, minVal, maxVal, minVal * 0.5, min(maxVal * 1.2, 255));
            }
          }

          blendedColor = color(avgR, avgG, avgB);
        }
      }

      let finalColor = blendedColor;
      if (!finalColor || isNaN(red(finalColor)) || isNaN(green(finalColor)) || isNaN(blue(finalColor))) {
        finalColor = genreColors['default'];
      }

      // 计算宽度（使用平方根映射让宽度更均匀）
      if (!isNaN(views) && views > 0) {
        // 使用平方根映射来压缩大值，让宽度差异更小
        let normalizedViews = (views - minViews) / (maxViews - minViews);
        normalizedViews = sqrt(normalizedViews);
        let rectWidth = map(normalizedViews, 0, 1, minRectWidth, maxRectWidth);

        // 调试：检查"Back in Action"的宽度计算
        const title = sortedRows[i].getString('primaryTitle');
        if (title === 'Back in Action') {
          fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:687', message: 'Back in Action width calculation', data: { title, views, minViews, maxViews, normalizedViewsBeforeSqrt: (views - minViews) / (maxViews - minViews), normalizedViewsAfterSqrt: normalizedViews, rectWidth, minRectWidth, maxRectWidth }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(() => {});
        }

        // 使用原生Canvas API绘制矩形（确保在异步绘制时正常工作）
        const r = Math.round(red(finalColor));
        const g = Math.round(green(finalColor));
        const b = Math.round(blue(finalColor));

        // 保存当前X位置（用于调试，避免闭包问题）
        const rectX = currentX;
        const rectW = rectWidth;

        // 使用原生Canvas API，但确保在正确的上下文中
        // 关键：使用canvas的实际context，并确保fillRect真正执行
        const intX = Math.floor(rectX);
        const intW = Math.ceil(rectW);
        
        // #region agent log
        if (i === 0) {
          fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sketch.js:750',message:'Before fillRect - using canvas context directly',data:{intX:intX,intW:intW,canvasHeight:canvas.height,color:`rgb(${r},${g},${b})`,ctxType:ctx.constructor.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
        }
        // #endregion
        
        // 直接使用canvas的原生context，确保fillRect真正执行
        // 不使用p5.js的drawingContext，因为我们在异步函数中
        const nativeCtx = canvas.getContext('2d');
        nativeCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        nativeCtx.globalCompositeOperation = 'source-over';
        nativeCtx.shadowBlur = 0;
        nativeCtx.shadowColor = 'transparent';
        nativeCtx.strokeStyle = 'transparent';
        nativeCtx.lineWidth = 0;
        
        // #region agent log
        if (i === 0) {
          fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sketch.js:760',message:'Calling fillRect on native context',data:{intX:intX,intW:intW,height:canvas.height,fillStyle:nativeCtx.fillStyle},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
        }
        // #endregion
        
        nativeCtx.fillRect(intX, 0, intW, canvas.height);
        
        // #region agent log
        if (i === 0) {
          fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sketch.js:765',message:'After fillRect - immediate pixel check',data:{intX:intX,intW:intW},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
          // 立即检查像素（同步检查）
          try {
            const immediateData = nativeCtx.getImageData(intX, 0, Math.min(10, intW), Math.min(10, canvas.height));
            let immediateFound = false;
            for (let idx = 0; idx < immediateData.data.length; idx += 4) {
              if (immediateData.data[idx] > 0 || immediateData.data[idx + 1] > 0 || immediateData.data[idx + 2] > 0) {
                immediateFound = true;
                fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sketch.js:770',message:'Immediate pixel check - FOUND',data:{idx:idx,r:immediateData.data[idx],g:immediateData.data[idx+1],b:immediateData.data[idx+2]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
                break;
              }
            }
            if (!immediateFound) {
              fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sketch.js:775',message:'Immediate pixel check - NOT FOUND',data:{intX:intX,intW:intW,dataLength:immediateData.data.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
            }
          } catch (e) {
            fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sketch.js:778',message:'Immediate pixel check error',data:{error:e.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
          }
        }
        // #endregion

        // 调试：检查前几个矩形的绘制
        if (i < 5) {
          print(`Drawing rect ${i}: x=${rectX} (int: ${intX}), width=${rectW} (int: ${intW}), height=${canvas.height}, color=${r},${g},${b}`);
        }

        // 调试：立即测试绘制是否成功（仅第一个矩形，保存rectX避免闭包问题）
        if (i === 0) {
          const savedX = intX;
          const savedW = intW;
          // 使用requestAnimationFrame确保绘制完成后再检查
          requestAnimationFrame(() => {
            try {
              const testData = ctx.getImageData(savedX, 0, Math.min(10, savedW), Math.min(10, canvas.height));
              let foundColor = false;
              for (let idx = 0; idx < testData.data.length; idx += 4) {
                if (testData.data[idx] > 0 || testData.data[idx + 1] > 0 || testData.data[idx + 2] > 0) {
                  foundColor = true;
                  print(`First rect pixel check: FOUND COLOR at index ${idx}, RGB=(${testData.data[idx]},${testData.data[idx + 1]},${testData.data[idx + 2]})`);
                  break;
                }
              }
              if (!foundColor) {
                print(`First rect pixel check: NO COLOR FOUND in rect at x=${savedX}, width=${savedW}`);
              }
            } catch (e) {
              print(`First rect pixel check error: ${e.message}`);
            }
          });
        }

        // 保存矩形信息用于查找
        rectsInfo.push({
          x: currentX,
          y: 0,
          w: rectWidth,
          h: height,
          row: sortedRows[i],
          color: finalColor,
          originalX: currentX,
          originalW: rectWidth,
        });

        currentX += rectWidth;
      }
    }

    // 继续绘制下一批（在for循环外面）
    if (i < sortedRows.length) {
      requestAnimationFrame(drawBatch);
    } else {
      // 绘制完成
      ctx.shadowBlur = 0;
      print(`Main canvas drawn: rectsInfo.length=${rectsInfo.length}, drawnRects=${i}`);

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sketch.js:812',message:'Drawing complete - final context state',data:{fillStyle:ctx.fillStyle,globalCompositeOperation:ctx.globalCompositeOperation,shadowBlur:ctx.shadowBlur,canvasWidth:canvas.width,canvasHeight:canvas.height,drawnRects:i},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion

      // 重置绘制标志
      isDrawing = false;

      // 调试：检查绘制结果（延迟执行，确保Chrome完成绘制）
      if (canvas) {
        canvas.style.display = 'block';
        canvas.style.visibility = 'visible';

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sketch.js:820',message:'Before delayed pixel check',data:{canvasWidth:canvas.width,canvasHeight:canvas.height,display:canvas.style.display,visibility:canvas.style.visibility},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion

        // 延迟检查Canvas内容，确保Chrome完成绘制
        setTimeout(() => {
          try {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sketch.js:825',message:'Delayed pixel check - starting',data:{checkWidth:Math.min(100, canvas.width),checkHeight:Math.min(100, canvas.height)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            
            const imageData = ctx.getImageData(0, 0, Math.min(100, canvas.width), Math.min(100, canvas.height));
            let hasNonBlackPixels = false;
            let firstNonBlackPixel = null;
            for (let idx = 0; idx < imageData.data.length; idx += 4) {
              if (imageData.data[idx] > 0 || imageData.data[idx + 1] > 0 || imageData.data[idx + 2] > 0) {
                hasNonBlackPixels = true;
                if (!firstNonBlackPixel) {
                  firstNonBlackPixel = {r: imageData.data[idx], g: imageData.data[idx + 1], b: imageData.data[idx + 2], idx: idx};
                }
                break;
              }
            }
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sketch.js:835',message:'Delayed pixel check - result',data:{hasNonBlackPixels:hasNonBlackPixels,firstNonBlackPixel:firstNonBlackPixel,dataLength:imageData.data.length,canvasWidth:canvas.width,canvasHeight:canvas.height},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            
            print(`Canvas check: width=${canvas.width}, height=${canvas.height}, hasNonBlackPixels=${hasNonBlackPixels}, rectsInfo.length=${rectsInfo.length}`);
          } catch (e) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sketch.js:840',message:'Delayed pixel check error',data:{error:e.message,stack:e.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            print(`Canvas check error: ${e.message}`);
          }
        }, 100);
      } else {
        print('ERROR: Canvas not found!');
      }

      // WebGL 3D效果已禁用，只使用简单的滚动功能
      // initSimpleHeightEffect();
    }
  }

  // 开始绘制
  drawBatch();
}

// WebGL + 顶点着色器实现平滑高度过渡效果
// 方案：使用GPU顶点着色器对每个顶点独立计算scaleY，实现完全平滑的过渡
let webglScene = null;
let webglCamera = null;
let webglRenderer = null;
let planeMesh = null;
let p5CanvasTexture = null;
let shaderMaterial = null;
let isInitializing = false; // Flag to prevent concurrent initialization

function initSimpleHeightEffect() {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:727', message: 'initSimpleHeightEffect called', data: { webglSceneExists: !!webglScene, webglRendererExists: !!webglRenderer, isInitializing: isInitializing }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'post-fix', hypothesisId: 'D' }) }).catch(() => {});
  // #endregion

  // 防止并发初始化
  if (isInitializing) {
    print('WebGL initialization already in progress, skipping...');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:732', message: 'Initialization in progress, skipping', data: {}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'post-fix', hypothesisId: 'D' }) }).catch(() => {});
    // #endregion
    return;
  }

  // 防止重复初始化 - 如果已经初始化且正常运行，直接返回
  if (webglRenderer && webglScene && webglCamera && planeMesh) {
    const webglCanvas = webglRenderer.domElement;
    if (webglCanvas && webglCanvas.parentNode) {
      print('WebGL already initialized, skipping...');
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:732', message: 'WebGL already initialized, skipping', data: {}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'post-fix', hypothesisId: 'D' }) }).catch(() => {});
      // #endregion
      return;
    }
  }

  // 设置初始化标志
  isInitializing = true;

  // 清理旧的WebGL资源
  if (webglRenderer) {
    print('Cleaning up existing WebGL renderer...');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:750', message: 'Cleaning up old renderer', data: { hasOldCanvas: !!webglRenderer.domElement, oldCanvasParent: webglRenderer.domElement?.parentNode?.tagName }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'post-fix', hypothesisId: 'D' }) }).catch(() => {});
    // #endregion
    // 移除旧的Canvas
    const oldCanvas = webglRenderer.domElement;
    if (oldCanvas && oldCanvas.parentNode) {
      oldCanvas.parentNode.removeChild(oldCanvas);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:760', message: 'Old canvas removed', data: {}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'post-fix', hypothesisId: 'F' }) }).catch(() => {});
      // #endregion
    }
    // 清理资源
    if (p5CanvasTexture) {
      p5CanvasTexture.dispose();
    }
    if (shaderMaterial) {
      shaderMaterial.dispose();
    }
    if (planeMesh && planeMesh.geometry) {
      planeMesh.geometry.dispose();
    }
    webglRenderer.dispose();
    // 取消动画循环
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    // 重置变量
    webglRenderer = null;
    webglScene = null;
    webglCamera = null;
    planeMesh = null;
    p5CanvasTexture = null;
    shaderMaterial = null;
    isInitializing = false;
  }

  // 清理容器中所有WebGL Canvas（防止残留）
  const container = document.getElementById('canvas-container');
  if (!container) {
    print('Warning: Container not found for WebGL effect');
    return;
  }

  // 先获取p5.js Canvas（在清理之前）
  const p5Canvas = container.querySelector('canvas');
  if (!p5Canvas) {
    print('Warning: p5.js Canvas not found for WebGL effect');
    return;
  }

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:780', message: 'Checking existing canvases', data: { totalCanvases: container.querySelectorAll('canvas').length, p5CanvasFound: !!p5Canvas }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'post-fix', hypothesisId: 'F' }) }).catch(() => {});
  // #endregion

  // 移除所有WebGL Canvas（更准确的识别方法）
  const allCanvases = container.querySelectorAll('canvas');
  const vpWidth = window.innerWidth;
  const vpHeight = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio, 2);

  allCanvases.forEach((canvas, index) => {
    // WebGL Canvas的特征：
    // 1. 不是p5.js Canvas（通过引用比较）
    // 2. 是WebGL渲染器的Canvas（通过检查是否是webglRenderer.domElement）
    // 3. 或者有特定的样式特征（position:absolute且width/height接近视窗大小）
    const isWebGLCanvas = canvas !== p5Canvas && ((webglRenderer && canvas === webglRenderer.domElement) || (canvas.style.position === 'absolute' && Math.abs(canvas.width - vpWidth * dpr) < 100)); // 允许100px误差

    if (isWebGLCanvas) {
      canvas.remove();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:790', message: 'Removed duplicate canvas', data: { canvasIndex: index, canvasWidth: canvas.width, canvasHeight: canvas.height, isWebGLRendererCanvas: webglRenderer && canvas === webglRenderer.domElement }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'post-fix', hypothesisId: 'F' }) }).catch(() => {});
      // #endregion
    } else if (canvas === p5Canvas) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:795', message: 'Preserved p5 canvas', data: { canvasIndex: index, canvasWidth: canvas.width, canvasHeight: canvas.height, canvasPosition: canvas.style.position }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'post-fix', hypothesisId: 'F' }) }).catch(() => {});
      // #endregion
    }
  });

  if (!container || !p5Canvas) {
    print('Warning: Container or canvas not found for WebGL effect');
    return;
  }

  print('Initializing WebGL shader-based height effect...');

  // 隐藏p5.js Canvas（但保留它用于纹理）
  p5Canvas.style.display = 'none';

  // 创建Three.js场景（使用黑色背景，因为容器背景是黑色）
  webglScene = new THREE.Scene();
  webglScene.background = new THREE.Color(0x000000); // 使用黑色背景，与页面背景一致

  // 创建相机（正交相机，保持2D效果）
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  webglCamera = new THREE.OrthographicCamera(-viewportWidth / 2, viewportWidth / 2, viewportHeight / 2, -viewportHeight / 2, 0.1, 10000);
  webglCamera.position.z = 1000;

  // 创建WebGL渲染器（关闭抗锯齿提升性能）
  webglRenderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  webglRenderer.setSize(viewportWidth, viewportHeight);
  // devicePixelRatio已在上面定义
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:754', message: 'Pixel ratio check', data: { devicePixelRatio: devicePixelRatio, viewportWidth: viewportWidth, viewportHeight: viewportHeight, effectiveWidth: viewportWidth * devicePixelRatio, effectiveHeight: viewportHeight * devicePixelRatio }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'post-fix', hypothesisId: 'C' }) }).catch(() => {});
  // #endregion
  webglRenderer.setPixelRatio(devicePixelRatio);

  // 将WebGL Canvas添加到容器
  const webglCanvas = webglRenderer.domElement;
  webglCanvas.style.position = 'absolute';
  webglCanvas.style.top = '0';
  webglCanvas.style.left = '0';
  webglCanvas.style.width = '100%';
  webglCanvas.style.height = '100%';
  // #region agent log
  const existingCanvases = container.querySelectorAll('canvas').length;
  fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:763', message: 'Adding WebGL canvas', data: { existingCanvases: existingCanvases, canvasWidth: webglCanvas.width, canvasHeight: webglCanvas.height }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'F' }) }).catch(() => {});
  // #endregion
  container.appendChild(webglCanvas);

  // 方案2：只创建视窗大小的平面几何体（大幅减少顶点数量）
  const canvasWidth = p5Canvas.width;
  const canvasHeight = p5Canvas.height;

  // 只使用视窗大小，而不是整个Canvas大小
  // 优化顶点数量：每100像素一个顶点，最多20个分段（视窗通常只有1000-2000px宽）
  const segmentsX = Math.min(Math.ceil(viewportWidth / 100), 20);
  const segmentsY = 1; // 垂直方向不需要细分
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:773', message: 'Geometry creation (viewport only)', data: { canvasWidth: canvasWidth, canvasHeight: canvasHeight, viewportWidth: viewportWidth, viewportHeight: viewportHeight, segmentsX: segmentsX, segmentsY: segmentsY, estimatedVertices: segmentsX * segmentsY * 4 }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'post-fix', hypothesisId: 'A' }) }).catch(() => {});
  // #endregion

  // 只创建视窗大小的平面
  const geometry = new THREE.PlaneGeometry(viewportWidth, viewportHeight, segmentsX, segmentsY);

  // 将p5.js Canvas转换为纹理
  // 注意：如果Canvas太大，WebGL会自动缩小纹理（最大16384x16384）
  p5CanvasTexture = new THREE.CanvasTexture(p5Canvas);
  p5CanvasTexture.needsUpdate = true;
  p5CanvasTexture.wrapS = THREE.ClampToEdgeWrapping;
  p5CanvasTexture.wrapT = THREE.ClampToEdgeWrapping;

  // #region agent log
  // 等待纹理加载后检查实际大小
  setTimeout(() => {
    const textureImage = p5CanvasTexture.image;
    fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:852', message: 'Texture created', data: { canvasWidth: p5Canvas.width, canvasHeight: p5Canvas.height, textureImageWidth: textureImage?.width, textureImageHeight: textureImage?.height, textureWasResized: textureImage && (textureImage.width !== p5Canvas.width || textureImage.height !== p5Canvas.height) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'post-fix', hypothesisId: 'G' }) }).catch(() => {});
  }, 100);
  // #endregion

  // 创建自定义着色器材质（方案2：视窗大小平面）
  const vertexShader = `
    uniform float scrollLeft;
    uniform float viewportWidth;
    uniform float viewportHeight;
    uniform float canvasWidth;
    uniform float canvasHeight;
    
    varying vec2 vUv;
    
    void main() {
      // PlaneGeometry的position.x范围是[-viewportWidth/2, viewportWidth/2]
      // 转换为视窗坐标系统[0, viewportWidth]
      float vertexXInViewport = position.x + viewportWidth / 2.0;
      
      // 计算这个顶点在Canvas上的实际位置
      float vertexXInCanvas = scrollLeft + vertexXInViewport;
      
      // 计算UV坐标：根据滚动位置和顶点在视窗中的位置，映射到Canvas纹理
      float u = vertexXInCanvas / canvasWidth;
      float v = uv.y; // 垂直方向不变
      vUv = vec2(u, v);
      
      // 计算顶点相对于视窗中心的距离（归一化到0-1）
      float viewportCenterX = viewportWidth / 2.0;
      float distanceFromCenter = abs(vertexXInViewport - viewportCenterX);
      float normalizedDistance = min(distanceFromCenter / (viewportWidth / 2.0), 1.0);
      
      // 计算scaleY：视窗中心最高(1.0)，两边平滑递减
      // 使用cos函数实现平滑过渡
      float scaleY = 1.0 - 0.6 * (1.0 - cos(normalizedDistance * 3.14159 / 2.0));
      scaleY = max(scaleY, 0.4); // 最小高度为0.4
      
      // PlaneGeometry的position.y范围是[-viewportHeight/2, viewportHeight/2]
      // 应用scaleY，相对于中心点缩放
      vec3 newPosition = position;
      newPosition.y = position.y * scaleY;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `;

  const fragmentShader = `
    uniform sampler2D canvasTexture;
    varying vec2 vUv;
    
    void main() {
      gl_FragColor = texture2D(canvasTexture, vUv);
    }
  `;

  shaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      scrollLeft: { value: 0.0 },
      viewportWidth: { value: viewportWidth },
      viewportHeight: { value: viewportHeight },
      canvasWidth: { value: canvasWidth },
      canvasHeight: { value: canvasHeight },
      canvasTexture: { value: p5CanvasTexture },
    },
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
  });

  // 创建平面网格
  planeMesh = new THREE.Mesh(geometry, shaderMaterial);
  // 调整平面位置：平面中心应该在Canvas中心，但相机中心在视窗中心
  // 初始时，视窗中心在Canvas的(viewportWidth/2, viewportHeight/2)位置
  // 但平面几何体的中心在(0,0)，所以需要调整
  // 由于使用正交相机，我们需要确保平面正确对齐
  planeMesh.position.set(0, 0, 0);
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:841', message: 'Plane mesh created', data: { planePosition: { x: planeMesh.position.x, y: planeMesh.position.y, z: planeMesh.position.z }, planeWidth: canvasWidth, planeHeight: canvasHeight, viewportWidth: viewportWidth, viewportHeight: viewportHeight, geometryVertices: geometry.attributes.position.count, sceneChildren: webglScene.children.length }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'post-fix', hypothesisId: 'F' }) }).catch(() => {});
  // #endregion
  webglScene.add(planeMesh);

  // 监听滚动，更新uniform变量（优化节流）
  let scrollTimeout;
  let scrollCallCount = 0;
  let isUpdating = false;
  container.addEventListener(
    'scroll',
    () => {
      scrollCallCount++;
      // #region agent log
      if (scrollCallCount % 10 === 0) {
        fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:849', message: 'Scroll event', data: { scrollCallCount: scrollCallCount, scrollLeft: container.scrollLeft }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'post-fix', hypothesisId: 'E' }) }).catch(() => {});
      }
      // #endregion
      if (isUpdating) return; // 防止重复更新
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isUpdating = true;
        updateWebGLHeight();
        requestAnimationFrame(() => {
          isUpdating = false;
        });
      }, 32); // 约30fps，减少更新频率
    },
    { passive: true }
  );

  // 监听窗口大小变化
  window.addEventListener('resize', () => {
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;

    webglCamera.left = -newWidth / 2;
    webglCamera.right = newWidth / 2;
    webglCamera.top = newHeight / 2;
    webglCamera.bottom = -newHeight / 2;
    webglCamera.updateProjectionMatrix();

    webglRenderer.setSize(newWidth, newHeight);

    if (shaderMaterial) {
      shaderMaterial.uniforms.viewportWidth.value = newWidth;
    }
  });

  // 初始更新（但不立即渲染，避免卡顿）
  // 不调用updateWebGLHeight()，等待第一次滚动时再渲染
  // updateWebGLHeight(); // 禁用初始渲染

  // 延迟启动动画循环，给浏览器一些时间
  setTimeout(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:1026', message: 'Starting animation loop (delayed)', data: {}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'post-fix', hypothesisId: 'K' }) }).catch(() => {});
    // #endregion
    // 启动动画循环，但不立即渲染（needsRender = false）
    needsRender = false;
    animateWebGL();
  }, 500); // 增加延迟到500ms

  // 重置初始化标志
  isInitializing = false;

  print('WebGL shader-based height effect initialized');
}

// 更新WebGL高度效果
function updateWebGLHeight() {
  if (!shaderMaterial || !planeMesh) return;

  const container = document.getElementById('canvas-container');
  if (!container) return;

  const scrollLeft = container.scrollLeft || 0;
  const viewportWidth = window.innerWidth || windowWidth;
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:884', message: 'updateWebGLHeight called', data: { scrollLeft: scrollLeft, viewportWidth: viewportWidth }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E' }) }).catch(() => {});
  // #endregion

  // 更新着色器uniform变量
  shaderMaterial.uniforms.scrollLeft.value = scrollLeft;
  shaderMaterial.uniforms.viewportWidth.value = viewportWidth;

  // 标记需要渲染
  needsRender = true;

  // 如果动画循环已暂停，重新启动
  if (!animationFrameId) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:1035', message: 'Restarting animation loop', data: {}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'post-fix', hypothesisId: 'I' }) }).catch(() => {});
    // #endregion
    animateWebGL();
  }
}

// WebGL动画循环（优化版：只在需要时渲染）
let renderCallCount = 0;
let lastRenderLogTime = 0;
let needsRender = true;
let animationFrameId = null;

function animateWebGL() {
  if (!webglRenderer || !webglScene || !webglCamera) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:1061', message: 'animateWebGL stopped - missing resources', data: { hasRenderer: !!webglRenderer, hasScene: !!webglScene, hasCamera: !!webglCamera }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'post-fix', hypothesisId: 'H' }) }).catch(() => {});
    // #endregion
    return;
  }

  renderCallCount++;
  const now = Date.now();
  // #region agent log
  if (now - lastRenderLogTime > 1000) {
    // 每秒记录一次
    fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:1069', message: 'Render call', data: { renderCallCount: renderCallCount, timeSinceLastLog: now - lastRenderLogTime, needsRender: needsRender, animationFrameId: animationFrameId }, timestamp: now, sessionId: 'debug-session', runId: 'post-fix', hypothesisId: 'B' }) }).catch(() => {});
    lastRenderLogTime = now;
  }
  // #endregion

  // 只在需要时渲染
  if (needsRender) {
    try {
      // #region agent log
      const renderStartTime = performance.now();
      // #endregion
      webglRenderer.render(webglScene, webglCamera);
      // #region agent log
      const renderEndTime = performance.now();
      const renderDuration = renderEndTime - renderStartTime;
      if (renderDuration > 16) {
        // 如果渲染时间超过16ms（60fps的阈值）
        fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:1090', message: 'Slow render detected', data: { renderDuration: renderDuration, renderCallCount: renderCallCount }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'post-fix', hypothesisId: 'J' }) }).catch(() => {});
      }
      // #endregion
      needsRender = false; // 渲染后重置标志
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:1100', message: 'Render error', data: { error: error.message, errorStack: error.stack }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'post-fix', hypothesisId: 'H' }) }).catch(() => {});
      // #endregion
      print('WebGL render error:', error);
      // 停止动画循环，但不要完全失败
      animationFrameId = null;
      return;
    }
  }

  // 继续动画循环（但只在需要时继续）
  // 如果needsRender为false且已经连续多次不需要渲染，可以暂停循环
  if (needsRender || renderCallCount % 60 < 2) {
    // 需要渲染，或者每60帧至少检查一次
    animationFrameId = requestAnimationFrame(animateWebGL);
  } else {
    // 不需要渲染，暂停循环，等待下次需要时再启动
    animationFrameId = null;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:1095', message: 'Animation loop paused', data: { renderCallCount: renderCallCount, needsRender: needsRender }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'post-fix', hypothesisId: 'I' }) }).catch(() => {});
    // #endregion
  }
}

// 旧的CSS分段代码已移除，改用Three.js实现
// 以下代码已废弃，保留用于参考
/*
function createCanvasSegments() {
  const container = document.getElementById('canvas-container');
  const canvas = document.querySelector('canvas');

  if (!container || !canvas) return;

  print('Starting segment creation...');

  // 设置容器的3D透视
  container.style.perspective = cameraDistance + 'px';
  container.style.perspectiveOrigin = '50% 50%';

  // 创建分段div来显示Canvas的不同部分
  // 使用适中的分段宽度，平衡平滑度和性能
  const segmentWidth = 200; // 每段宽度（平衡平滑度和性能）
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const numSegments = Math.ceil(canvasWidth / segmentWidth);

  print(`Canvas size: ${canvasWidth}x${canvasHeight}, will create ${numSegments} segments`);

  // 先获取Canvas的dataURL（只获取一次，缓存起来）
  if (!canvasDataURLCache) {
    print('Converting canvas to data URL (this may take a moment)...');
    const startTime = performance.now();
    canvasDataURLCache = canvas.toDataURL('image/png', 0.9);
    const endTime = performance.now();
    print(`Canvas converted in ${(endTime - startTime).toFixed(0)}ms`);
  }
  const canvasDataURL = canvasDataURLCache;

  // 隐藏原始Canvas
  canvas.style.display = 'none';

  // 创建主wrapper
  const canvasWrapper = document.createElement('div');
  canvasWrapper.id = 'canvas-wrapper';
  canvasWrapper.style.position = 'absolute';
  canvasWrapper.style.top = '0';
  canvasWrapper.style.left = '0';
  canvasWrapper.style.width = canvasWidth + 'px';
  canvasWrapper.style.height = canvasHeight + 'px';
  canvasWrapper.style.transformStyle = 'preserve-3d';

  const canvasParent = canvas.parentNode;
  if (canvasParent) {
    canvasParent.insertBefore(canvasWrapper, canvas);
  }

  // 只创建可见区域附近的分段（减少DOM元素数量，提升性能）
  const scrollLeft = container.scrollLeft || 0;
  const viewportWidth = window.innerWidth || windowWidth;
  const visibleStart = Math.max(0, Math.floor((scrollLeft - viewportWidth * 2) / segmentWidth));
  const visibleEnd = Math.min(numSegments, Math.ceil((scrollLeft + viewportWidth * 3) / segmentWidth));

  print(`Creating segments ${visibleStart} to ${visibleEnd}...`);

  // 使用DocumentFragment批量创建
  const fragment = document.createDocumentFragment();

  for (let i = visibleStart; i < visibleEnd; i++) {
    const segStartX = i * segmentWidth;
    const segEndX = Math.min((i + 1) * segmentWidth, canvasWidth);
    const segWidth = segEndX - segStartX;

    const segmentDiv = document.createElement('div');
    segmentDiv.className = 'canvas-segment';
    segmentDiv.style.position = 'absolute';
    segmentDiv.style.left = segStartX + 'px';
    segmentDiv.style.top = '0';
    segmentDiv.style.width = segWidth + 'px';
    segmentDiv.style.height = canvasHeight + 'px';
    segmentDiv.style.backgroundImage = `url(${canvasDataURL})`;
    segmentDiv.style.backgroundPosition = `-${segStartX}px 0`;
    segmentDiv.style.backgroundSize = `${canvasWidth}px ${canvasHeight}px`;
    segmentDiv.style.backgroundRepeat = 'no-repeat';
    segmentDiv.style.willChange = 'transform';
    segmentDiv.dataset.segmentIndex = i;
    segmentDiv.dataset.segmentCenterX = segStartX + segWidth / 2;

    fragment.appendChild(segmentDiv);
    canvasSegments.push(segmentDiv);
  }

  canvasWrapper.appendChild(fragment);
  print(`Created ${canvasSegments.length} segments`);

  // 监听滚动，更新CSS transform（使用节流优化性能）
  let scrollTimeout;
  let rafId = null;
  let lastSegmentUpdateTime = 0;
  const SEGMENT_UPDATE_INTERVAL = 500; // 每500ms更新一次分段

  container.addEventListener(
    'scroll',
    () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            updateCSS3DTransform();

            // 减少分段更新频率，避免卡顿（每500ms更新一次）
            const now = performance.now();
            if (now - lastSegmentUpdateTime > SEGMENT_UPDATE_INTERVAL) {
              updateCanvasSegments();
              lastSegmentUpdateTime = now;
            }

            rafId = null;
          });
        }
      }, 16);
    },
    { passive: true }
  );

  // 初始更新
  updateCSS3DTransform();

  print(`CSS 3D cylinder effect initialized with ${canvasSegments.length} segments`);

  // 添加一个测试：打印第一个和中间分段的scaleY值
  if (canvasSegments.length > 0) {
    const firstSegment = canvasSegments[0];
    const midSegment = canvasSegments[Math.floor(canvasSegments.length / 2)];
    print(`First segment center: ${firstSegment.dataset.segmentCenterX}, Mid segment center: ${midSegment.dataset.segmentCenterX}`);
  }
}

// 动态更新Canvas分段（只保留可见区域附近的分段）
function updateCanvasSegments() {
  const container = document.getElementById('canvas-container');
  const canvasWrapper = document.getElementById('canvas-wrapper');
  const canvas = document.querySelector('canvas');

  if (!container || !canvasWrapper || !canvas) return;

  const scrollLeft = container.scrollLeft || 0;
  const viewportWidth = window.innerWidth || windowWidth;
  const segmentWidth = 200;
  const canvasWidth = canvas.width;
  const numSegments = Math.ceil(canvasWidth / segmentWidth);

  const visibleStart = Math.max(0, Math.floor((scrollLeft - viewportWidth * 1.5) / segmentWidth));
  const visibleEnd = Math.min(numSegments, Math.ceil((scrollLeft + viewportWidth * 2.5) / segmentWidth));

  // 移除不在可见区域的分段
  const segmentsToRemove = [];
  canvasSegments.forEach((segment, index) => {
    const segIndex = parseInt(segment.dataset.segmentIndex);
    if (segIndex < visibleStart || segIndex >= visibleEnd) {
      segmentsToRemove.push(index);
      segment.remove();
    }
  });

  segmentsToRemove.reverse().forEach((index) => {
    canvasSegments.splice(index, 1);
  });

  // 创建新的分段（如果需要）
  const existingIndices = new Set(canvasSegments.map((s) => parseInt(s.dataset.segmentIndex)));

  // 如果不需要创建新分段，直接返回
  let needsNewSegments = false;
  for (let i = visibleStart; i < visibleEnd; i++) {
    if (!existingIndices.has(i)) {
      needsNewSegments = true;
      break;
    }
  }

  if (!needsNewSegments) {
    return; // 不需要创建新分段，直接返回
  }

  // 使用缓存的dataURL，避免重复转换
  if (!canvasDataURLCache) {
    canvasDataURLCache = canvas.toDataURL('image/png', 0.9);
  }
  const canvasDataURL = canvasDataURLCache;

  // 批量创建新分段
  const fragment = document.createDocumentFragment();
  const newSegments = [];

  for (let i = visibleStart; i < visibleEnd; i++) {
    if (!existingIndices.has(i)) {
      const segStartX = i * segmentWidth;
      const segEndX = Math.min((i + 1) * segmentWidth, canvasWidth);
      const segWidth = segEndX - segStartX;

      const segmentDiv = document.createElement('div');
      segmentDiv.className = 'canvas-segment';
      segmentDiv.style.position = 'absolute';
      segmentDiv.style.left = segStartX + 'px';
      segmentDiv.style.top = '0';
      segmentDiv.style.width = segWidth + 'px';
      segmentDiv.style.height = canvas.height + 'px';
      segmentDiv.style.backgroundImage = `url(${canvasDataURL})`;
      segmentDiv.style.backgroundPosition = `-${segStartX}px 0`;
      segmentDiv.style.backgroundSize = `${canvasWidth}px ${canvas.height}px`;
      segmentDiv.style.backgroundRepeat = 'no-repeat';
      segmentDiv.style.willChange = 'transform';
      segmentDiv.dataset.segmentIndex = i;
      segmentDiv.dataset.segmentCenterX = segStartX + segWidth / 2;

      fragment.appendChild(segmentDiv);
      newSegments.push(segmentDiv);
    }
  }

  // 批量添加到DOM
  if (fragment.children.length > 0) {
    canvasWrapper.appendChild(fragment);
    canvasSegments.push(...newSegments);
    // 立即更新transform，避免闪烁
    updateCSS3DTransform();
  }
}

// 更新CSS 3D变换实现圆柱体效果（不重绘Canvas）
// 对每个分段应用不同的transform，实现真正的圆柱体效果
function updateCSS3DTransform() {
  const container = document.getElementById('canvas-container');
  const canvasWrapper = document.getElementById('canvas-wrapper');

  if (!container || !canvasWrapper) {
    return;
  }

  // 如果分段还没创建，直接返回（避免错误）
  if (canvasSegments.length === 0) {
    return;
  }

  const scrollLeft = container.scrollLeft || 0;
  const viewportWidth = window.innerWidth || windowWidth;

  // 计算视窗中心在Canvas上的位置
  const viewportCenterX = scrollLeft + viewportWidth / 2;

  // 对每个分段应用不同的transform
  canvasSegments.forEach((segment) => {
    const segmentCenterX = parseFloat(segment.dataset.segmentCenterX);

    // 计算分段中心相对于视窗中心的位置
    const offsetFromViewportCenter = segmentCenterX - viewportCenterX;
    const distanceFromViewportCenter = Math.abs(offsetFromViewportCenter);
    const normalizedDistance = Math.min(distanceFromViewportCenter / (viewportWidth / 2), 1.0);

    // 圆柱体效果：视窗中心最高，两边变低
    // 使用适中的效果，既明显又平滑
    let scaleY = 1.0 - 0.5 * (1 - Math.cos((normalizedDistance * Math.PI) / 2));
    const scaleX = 1.0 - 0.15 * (1 - Math.cos((normalizedDistance * Math.PI) / 2));

    // 确保视窗中心的分段最高
    if (normalizedDistance < 0.01) {
      scaleY = 1.0;
    }

    // 限制最小高度，确保效果可见
    scaleY = Math.max(scaleY, 0.5);

    // 计算Y偏移（模拟圆柱体弯曲）：中间最高，两边向下
    const yOffset = normalizedDistance * normalizedDistance * 80;

    // 应用transform到每个分段
    segment.style.transform = `scale(${scaleX}, ${scaleY}) translateY(${yOffset}px)`;
    segment.style.transformOrigin = '50% 50%';
  });
}
*/

// 更新 HTML 中的电影信息
function updateMovieInfo(movieIndex) {
  const movieInfoDiv = document.getElementById('movie-info');

  if (movieIndex >= 0 && movieIndex < rectsInfo.length) {
    const info = rectsInfo[movieIndex];
    const title = info.row.getString('primaryTitle');
    const year = info.row.getString('startYear');
    const views = info.row.getString('Views');
    const viewsFormatted = views ? parseFloat(views).toLocaleString() : 'N/A';
    const genres = info.row.getString('genres');

    movieInfoDiv.innerHTML = `
      <p class="movie-title">${title}</p>
      <p class="movie-meta">${year} • ${viewsFormatted} views</p>
      <p class="movie-genres">${genres}</p>
    `;
  } else {
    movieInfoDiv.innerHTML = '<p class="hint">Click on a movie bar to see details</p>';
  }
}

// 获取指示线在Canvas中的X坐标（指示线固定在视窗中央）
function getIndicatorCanvasX() {
  const canvas = document.querySelector('canvas');
  const container = document.getElementById('canvas-container');

  if (!canvas || !container) {
    return 0;
  }

  // 获取Canvas在视窗中的位置
  const canvasRect = canvas.getBoundingClientRect();

  // 获取容器的滚动位置
  const scrollLeft = container.scrollLeft || 0;

  // 指示线固定在视窗中央（50%），计算相对于Canvas的X坐标
  const viewportCenterX = window.innerWidth / 2;
  const canvasX = viewportCenterX - canvasRect.left + scrollLeft;

  return canvasX;
}

// 使用二分查找优化查找速度（因为rectsInfo是按x坐标排序的）
function findMovieIndexByX(canvasX) {
  if (rectsInfo.length === 0) return -1;

  // 二分查找（使用原始X位置，因为3D变换不影响水平位置）
  let left = 0;
  let right = rectsInfo.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const info = rectsInfo[mid];

    // 使用originalX和originalW进行查找（不受3D变换影响）
    const rectX = info.originalX !== undefined ? info.originalX : info.x;
    const rectW = info.originalW !== undefined ? info.originalW : info.w;

    if (canvasX >= rectX && canvasX <= rectX + rectW) {
      return mid; // 找到了
    } else if (canvasX < rectX) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return -1;
}

// 根据指示线位置找到对应的电影并更新信息
function updateMovieFromLine() {
  // 预览模式下不更新（避免干扰点击选择）
  if (isOverviewMode) {
    return;
  }

  if (!dataProcessed || !sortedRows || rectsInfo.length === 0) {
    return;
  }

  // 获取指示线在Canvas中的X坐标
  const canvasX = getIndicatorCanvasX();

  // 使用二分查找找到电影
  const foundIndex = findMovieIndexByX(canvasX);

  // 如果找到了电影且与当前选中的不同，才更新
  if (foundIndex >= 0 && foundIndex !== selectedMovieIndex) {
    selectedMovieIndex = foundIndex;
    updateMovieInfo(foundIndex);
    // 移除高亮效果，不再显示高亮
  }
}

// 自动滚动功能
let autoScrollSpeed = 0.5; // 滚动速度（像素/帧）
let isAutoScrolling = true;
let isUserInteracting = false; // 用户是否在交互（拖拽或点击）

function startAutoScroll() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  let lastTime = performance.now();
  // 使用变量跟踪精确的滚动位置，解决Safari不支持小数scrollLeft的问题
  let preciseScroll = container.scrollLeft;

  function animateScroll(currentTime) {
    if (!isAutoScrolling || isUserInteracting) {
      // 当暂停或用户交互时，同步真实滚动位置并重置时间
      preciseScroll = container.scrollLeft;
      lastTime = currentTime;
      requestAnimationFrame(animateScroll);
      return;
    }

    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // 计算滚动距离（基于时间，保持恒定速度）
    const scrollDelta = (autoScrollSpeed * deltaTime) / 16.67; // 标准化到60fps

    // 更新精确位置
    preciseScroll += scrollDelta;
    
    const maxScroll = container.scrollWidth - container.clientWidth;

    if (preciseScroll < maxScroll) {
      container.scrollLeft = preciseScroll;
    } else {
      // 到达末尾，可以循环或停止
      // 这里选择循环：重置到开始
      preciseScroll = 0;
      container.scrollLeft = 0;
    }

    // 更新电影信息（因为Canvas位置改变了）
    updateMovieFromLine();

    requestAnimationFrame(animateScroll);
  }

  requestAnimationFrame(animateScroll);

  // 用户交互时暂停自动滚动
  container.addEventListener('mousedown', () => {
    isUserInteracting = true;
  });

  container.addEventListener('mouseup', () => {
    // 延迟恢复滚动，给用户一些时间
    setTimeout(() => {
      isUserInteracting = false;
      // 恢复时重新同步位置，防止跳变
      preciseScroll = container.scrollLeft;
    }, 2000); // 2秒后恢复
  });

  container.addEventListener('wheel', () => {
    isUserInteracting = true;
    setTimeout(() => {
      isUserInteracting = false;
      preciseScroll = container.scrollLeft;
    }, 2000);
  });
  
  // 触摸事件支持（移动端/Safari）
  container.addEventListener('touchstart', () => {
    isUserInteracting = true;
  }, { passive: true });
  
  container.addEventListener('touchend', () => {
    setTimeout(() => {
      isUserInteracting = false;
      preciseScroll = container.scrollLeft;
    }, 2000);
  }, { passive: true });
}

// 初始化HTML指示线（固定在视窗中央，不可移动）
function initIndicatorLine() {
  const indicatorLine = document.getElementById('indicator-line');

  if (!indicatorLine) {
    return;
  }

  // 确保指示线固定在视窗中央
  indicatorLine.style.left = '50%';
  indicatorLine.style.transform = 'translateX(-50%)';

  // 监听滚动事件，更新电影信息
  const container = document.getElementById('canvas-container');
  if (container) {
    let scrollTimeout;
    const scrollHandler = () => {
      clearTimeout(scrollTimeout);
      // 滚动停止后300ms才更新（避免滚动时频繁计算）
      scrollTimeout = setTimeout(() => {
        updateMovieFromLine();
      }, 300);
    };

    container.addEventListener('scroll', scrollHandler, { passive: true });
  }

  // 监听window滚动
  window.addEventListener(
    'scroll',
    () => {
      updateMovieFromLine();
    },
    { passive: true }
  );

  // 初始化时更新一次电影信息
  setTimeout(() => {
    updateMovieFromLine();
  }, 100);

  print('Indicator line initialized (fixed at viewport center)');
}

// 初始化底部信息栏的收起/展开功能
function initBottomBarToggle() {
  const bottomBar = document.getElementById('bottom-bar');
  const toggleBtn = document.getElementById('toggle-bar-btn');

  if (!bottomBar || !toggleBtn) {
    print('Warning: Bottom bar or toggle button not found');
    return;
  }

  let isCollapsed = false;

  toggleBtn.addEventListener('click', () => {
    isCollapsed = !isCollapsed;

    if (isCollapsed) {
      // 收起
      bottomBar.classList.add('collapsed');
      toggleBtn.classList.add('collapsed');
    } else {
      // 展开
      bottomBar.classList.remove('collapsed');
      toggleBtn.classList.remove('collapsed');
    }
  });

  print('Bottom bar toggle initialized');
}

// 初始化全局预览切换功能
function initOverviewToggle() {
  const overviewBtn = document.getElementById('toggle-overview-btn');
  const container = document.getElementById('canvas-container');
  const canvas = document.querySelector('canvas');

  if (!overviewBtn || !container || !canvas) {
    print('Warning: Overview toggle elements not found');
    return;
  }

  overviewBtn.addEventListener('click', () => {
    isOverviewMode = !isOverviewMode;

    if (isOverviewMode) {
      // 进入预览模式
      overviewBtn.classList.add('active');
      container.style.overflow = 'hidden'; // 禁用滚动

      // 停止自动滚动（如果正在运行）
      isAutoScrolling = false;

      // 隐藏指示线
      const indicatorLine = document.getElementById('indicator-line');
      if (indicatorLine) {
        indicatorLine.style.display = 'none';
      }
      
      // 隐藏底部信息栏
      const bottomBar = document.getElementById('bottom-bar');
      if (bottomBar) {
        bottomBar.style.display = 'none';
      }
      
      // 隐藏底部信息栏切换按钮
      const toggleBarBtn = document.getElementById('toggle-bar-btn');
      if (toggleBarBtn) {
        toggleBarBtn.style.display = 'none';
      }

      // 调整Canvas大小以适应预览模式（使用视窗大小）
      resizeCanvas(window.innerWidth, window.innerHeight);

      // 重新绘制预览版本（只绘制一次，避免卡顿）
      redraw();
    } else {
      // 退出预览模式
      overviewBtn.classList.remove('active');
      container.style.overflow = 'auto'; // 恢复滚动

      // 恢复自动滚动
      isAutoScrolling = true;

      // 显示指示线
      const indicatorLine = document.getElementById('indicator-line');
      if (indicatorLine) {
        indicatorLine.style.display = 'block';
      }
      
      // 显示底部信息栏
      const bottomBar = document.getElementById('bottom-bar');
      if (bottomBar) {
        bottomBar.style.display = 'block';
      }
      
      // 显示底部信息栏切换按钮
      const toggleBarBtn = document.getElementById('toggle-bar-btn');
      if (toggleBarBtn) {
        toggleBarBtn.style.display = 'flex'; // 使用flex以保持居中对齐
      }
      
      // 隐藏悬浮提示框
      hideTooltip();

      // 恢复原始Canvas大小
      resizeCanvas(windowWidth, windowHeight);

      // 重新计算主视图的布局数据
      calculateMainLayout();

      // 恢复原始Canvas
      // 触发一次重绘以显示当前视口内容
      redraw();
    }
  });

  print('Overview toggle initialized');
}

// 计算主视图的布局数据
function calculateMainLayout() {
  rectsInfo = [];
  let currentX = 0;
  let rectHeight = windowHeight;

  for (let i = 0; i < sortedRows.length; i++) {
    let viewsStr = sortedRows[i].getString('Views');
    let views = parseFloat(viewsStr);

    if (!isNaN(views) && views > 0) {
      // Normalize and map views to width
      let normalizedViews = (views - minViews) / (maxViews - minViews);
      normalizedViews = sqrt(normalizedViews);
      let rectWidth = map(normalizedViews, 0, 1, minRectWidth, maxRectWidth);
      
      // Determine color
      let genresStr = sortedRows[i].getString('genres');
      let genres = [];
      if (genresStr) {
        genres = genresStr.split(',').map(g => g.trim());
      }
      
      let blendedColor;
      if (genres.length === 0 || !genresStr) {
        blendedColor = genreColors['default'];
      } else if (genres.length === 1) {
        blendedColor = genreColors[genres[0]] || genreColors['default'];
      } else {
        // 混合多个类型的颜色
        let totalR = 0,
          totalG = 0,
          totalB = 0;
        let validGenres = 0;
        let hasDarkColor = false;
        let hasBrightColor = false;
        let hasWarmColor = false;

        // Define bright genres
        const brightGenres = ['Comedy', 'Animation'];
        // Define warm genres
        const warmGenres = ['Action', 'Romance', 'Adventure', 'Crime'];

        for (const genre of genres) {
          const c = genreColors[genre] || genreColors.default;
          if (c) {
            totalR += red(c);
            totalG += green(c);
            totalB += blue(c);
            validGenres++;

            let brightness = (red(c) + green(c) + blue(c)) / 3;
            if (brightness < 50) {
              hasDarkColor = true;
            }
            
            if (brightGenres.includes(genre)) {
              hasBrightColor = true;
            }
            if (warmGenres.includes(genre)) {
              hasWarmColor = true;
            }
          }
        }

        if (validGenres === 0) {
          blendedColor = genreColors['default'];
        } else {
          let avgR = totalR / validGenres;
          let avgG = totalG / validGenres;
          let avgB = totalB / validGenres;

          // 如果包含暗色，压得更暗
        if (hasDarkColor) {
          let currentBrightness = (avgR + avgG + avgB) / 3;
          // 大幅降低亮度
          if (currentBrightness > 50) {
            let darkenFactor = 50 / currentBrightness;
            avgR *= darkenFactor;
            avgG *= darkenFactor;
            avgB *= darkenFactor;
          }
          // 再额外压暗 20%
          avgR *= 0.8;
          avgG *= 0.8;
          avgB *= 0.8;
        } else {
          // 如果都是亮色，大幅提升亮度和饱和度
          let currentBrightness = (avgR + avgG + avgB) / 3;
          
          // 提升亮度 50%
          let brightenFactor = 1.5;
          avgR = min(avgR * brightenFactor, 255);
          avgG = min(avgG * brightenFactor, 255);
          avgB = min(avgB * brightenFactor, 255);
          
          // 增强饱和度：找到最大和最小的 RGB 值，拉大差距
          let maxVal = max(avgR, avgG, avgB);
          let minVal = min(avgR, avgG, avgB);
          
          if (maxVal > 0) {
            // 让最大值更接近 255，最小值更接近 0
            avgR = map(avgR, minVal, maxVal, minVal * 0.5, min(maxVal * 1.2, 255));
            avgG = map(avgG, minVal, maxVal, minVal * 0.5, min(maxVal * 1.2, 255));
            avgB = map(avgB, minVal, maxVal, minVal * 0.5, min(maxVal * 1.2, 255));
          }
        }
        
        blendedColor = color(avgR, avgG, avgB);
        }
      }

      let finalColor = blendedColor;
      if (!finalColor || isNaN(red(finalColor)) || isNaN(green(finalColor)) || isNaN(blue(finalColor))) {
        finalColor = genreColors['default'];
      }

      // Store rect info
      rectsInfo.push({
        x: currentX,
        y: 0,
        w: rectWidth,
        h: rectHeight,
        row: sortedRows[i],
        color: finalColor,
        originalX: currentX,
        originalW: rectWidth,
      });

      currentX += rectWidth;
    }
  }
}

// 绘制全局预览模式（分行、缩小）
function drawOverviewMode() {
  if (!sortedRows || sortedRows.length === 0) return;

  // 清空背景
  background('black');
  strokeWeight(0);

  // 清空rectsInfo，准备保存预览模式的色块信息
  rectsInfo = [];

  // 计算预览参数
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const padding = 20;
  const availableWidth = viewportWidth - padding * 2;
  const availableHeight = viewportHeight - padding * 2;
  const rowSpacing = 4;

  // 1. 预计算所有电影的宽度和颜色
  let items = [];
  for (let i = 0; i < sortedRows.length; i++) {
    let viewsStr = sortedRows[i].getString('Views');
    let views = parseFloat(viewsStr);

    if (isNaN(views) || views <= 0) {
      continue;
    }

    // 计算宽度 (使用 sqrt 保持一致性)
    let normalizedViews = (views - minViews) / (maxViews - minViews);
    normalizedViews = sqrt(normalizedViews);
    let rectWidth = map(normalizedViews, 0, 1, minRectWidth, maxRectWidth);

    // 获取颜色
    let genresStr = sortedRows[i].getString('genres');
    let genres = [];
    if (genresStr) {
      genres = genresStr.split(',').map((g) => g.trim());
    }

    let blendedColor;
    if (genres.length === 0 || !genresStr) {
      blendedColor = genreColors['default'];
    } else if (genres.length === 1) {
      blendedColor = genreColors[genres[0]] || genreColors['default'];
    } else {
      // 混合多个类型的颜色
      let totalR = 0,
        totalG = 0,
        totalB = 0;
      let validGenres = 0;
      let hasDarkColor = false;
      let hasBrightColor = false;
      let hasWarmColor = false;

      // Define bright genres
      const brightGenres = ['Comedy', 'Animation'];
      // Define warm genres
      const warmGenres = ['Action', 'Romance', 'Adventure', 'Crime'];

      for (const genre of genres) {
        const c = genreColors[genre] || genreColors.default;
        if (c) {
          totalR += red(c);
          totalG += green(c);
          totalB += blue(c);
          validGenres++;

          let brightness = (red(c) + green(c) + blue(c)) / 3;
          if (brightness < 50) {
            hasDarkColor = true;
          }
          
          if (brightGenres.includes(genre)) {
            hasBrightColor = true;
          }
          if (warmGenres.includes(genre)) {
            hasWarmColor = true;
          }
        }
      }

      if (validGenres === 0) {
        blendedColor = genreColors['default'];
      } else {
        let avgR = totalR / validGenres;
        let avgG = totalG / validGenres;
        let avgB = totalB / validGenres;

        // 如果包含暗色，压得更暗
        if (hasDarkColor) {
          let currentBrightness = (avgR + avgG + avgB) / 3;
          // 大幅降低亮度
          if (currentBrightness > 50) {
            let darkenFactor = 50 / currentBrightness;
            avgR *= darkenFactor;
            avgG *= darkenFactor;
            avgB *= darkenFactor;
          }
          // 再额外压暗 20%
          avgR *= 0.8;
          avgG *= 0.8;
          avgB *= 0.8;
        } else {
          // 如果都是亮色，大幅提升亮度和饱和度
          let currentBrightness = (avgR + avgG + avgB) / 3;
          
          // 提升亮度 50%
          let brightenFactor = 1.5;
          avgR = min(avgR * brightenFactor, 255);
          avgG = min(avgG * brightenFactor, 255);
          avgB = min(avgB * brightenFactor, 255);
          
          // 增强饱和度：找到最大和最小的 RGB 值，拉大差距
          let maxVal = max(avgR, avgG, avgB);
          let minVal = min(avgR, avgG, avgB);
          
          if (maxVal > 0) {
            // 让最大值更接近 255，最小值更接近 0
            avgR = map(avgR, minVal, maxVal, minVal * 0.5, min(maxVal * 1.2, 255));
            avgG = map(avgG, minVal, maxVal, minVal * 0.5, min(maxVal * 1.2, 255));
            avgB = map(avgB, minVal, maxVal, minVal * 0.5, min(maxVal * 1.2, 255));
          }
        }
        
        blendedColor = color(avgR, avgG, avgB);
      }
    }

    let finalColor = blendedColor;
    if (!finalColor || isNaN(red(finalColor)) || isNaN(green(finalColor)) || isNaN(blue(finalColor))) {
      finalColor = genreColors['default'];
    }

    items.push({
      width: rectWidth,
      row: sortedRows[i],
      color: finalColor
    });
  }

  // 2. 模拟布局以确定行数
  let rows = [];
  let currentRow = [];
  let currentRowWidth = 0;

  for (let item of items) {
    // 如果当前行加上这个元素会超过可用宽度，且当前行不为空，则换行
    if (currentRowWidth + item.width > availableWidth && currentRow.length > 0) {
      rows.push({ items: currentRow, width: currentRowWidth });
      currentRow = [];
      currentRowWidth = 0;
    }
    currentRow.push(item);
    currentRowWidth += item.width;
  }
  // 添加最后一行
  if (currentRow.length > 0) {
    rows.push({ items: currentRow, width: currentRowWidth });
  }

  // 3. 计算行高以适应屏幕
  let numRows = rows.length;
  let totalSpacing = (numRows - 1) * rowSpacing;
  // 计算每行高度，确保填满高度
  let rowHeight = (availableHeight - totalSpacing) / numRows;
  
  // 限制最小和最大行高，避免极端情况
  // 如果行数太少，不要让行高变得巨大
  rowHeight = Math.min(rowHeight, 150); 
  // 如果行数太多，行高可能会很小，但为了"Overview"能看到全貌，我们接受较小的行高
  // 除非实在太小无法渲染
  if (rowHeight < 2) rowHeight = 2;

  // 4. 绘制
  let currentY = padding;
  
  // 移除默认阴影效果
  drawingContext.shadowBlur = 0;
  drawingContext.shadowOffsetX = 0;
  drawingContext.shadowOffsetY = 0;

  for (let i = 0; i < rows.length; i++) {
    let row = rows[i];
    let isLastRow = (i === rows.length - 1);
    
    // 计算该行的缩放比例，使其填满宽度（两端对齐）
    let rowScale = 1;
    if (!isLastRow) {
      rowScale = availableWidth / row.width;
    } else {
      // 最后一行不强制对齐，保持自然宽度（或者使用1.0）
      rowScale = 1.0;
    }
    
    let currentX = padding;
    for (let item of row.items) {
      let itemWidth = item.width * rowScale;
      
      // 检查是否是被选中的电影
      // 注意：这里我们需要一种方式来识别是否是当前选中的电影
      // 由于rectsInfo被重置了，我们不能直接用selectedMovieIndex
      // 但我们可以比较row对象
      let isSelected = false;
      if (selectedMovieIndex >= 0 && rectsInfo.length > selectedMovieIndex) {
         // 这里的逻辑有点复杂，因为rectsInfo正在被重建
         // 更好的方式是在点击时记录选中的row，或者在重绘时根据ID判断
         // 简单起见，我们可以在点击时触发重绘，并在这里判断
      }
      
      // 绘制矩形
      fill(item.color);
      rect(currentX, currentY, itemWidth, rowHeight);
      
      // 保存色块信息用于点击检测
      rectsInfo.push({
        x: currentX,
        y: currentY,
        w: itemWidth,
        h: rowHeight,
        row: item.row,
        color: item.color,
        originalX: currentX,
        originalW: itemWidth,
      });
      
      // 如果被选中，绘制高亮边框
      if (selectedMovieIndex >= 0 && item.row === sortedRows[selectedMovieIndex]) {
         // Draw highlight
         let c = item.color;
         let rVal = red(c);
         let gVal = green(c);
         let bVal = blue(c);
         
         let ctx = drawingContext;
         ctx.strokeStyle = 'white';
         ctx.lineWidth = 2;
         ctx.strokeRect(currentX, currentY, itemWidth, rowHeight);
         
         // Draw shadow/glow for selected item
         ctx.shadowBlur = 15;
         ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
         ctx.fillStyle = `rgba(${rVal}, ${gVal}, ${bVal}, 0.8)`; // Semi-transparent overlay
         ctx.fillRect(currentX, currentY, itemWidth, rowHeight);
         ctx.shadowBlur = 0; // Reset
      }
      
      currentX += itemWidth;
    }
    
    currentY += rowHeight + rowSpacing;
  }
  
  // 如果有选中的电影，重新绘制它以添加阴影效果（浮起效果）
  if (selectedMovieIndex >= 0 && selectedMovieIndex < rectsInfo.length) {
    let selectedRect = rectsInfo[selectedMovieIndex];
    
    drawingContext.save();
    drawingContext.shadowBlur = 20;
    drawingContext.shadowColor = 'rgba(0, 0, 0, 0.8)';
    drawingContext.shadowOffsetX = 0;
    drawingContext.shadowOffsetY = 4;
    
    // 稍微放大一点点
    let scale = 1.1;
    let newW = selectedRect.w * scale;
    let newH = selectedRect.h * scale;
    let newX = selectedRect.x - (newW - selectedRect.w) / 2;
    let newY = selectedRect.y - (newH - selectedRect.h) / 2;
    
    fill(selectedRect.color);
    rect(newX, newY, newW, newH);
    drawingContext.restore();
  }

  // 重置阴影
  drawingContext.shadowBlur = 0;
}

// 处理鼠标点击（预览模式下）
function mousePressed() {
  if (!isOverviewMode || !dataProcessed || rectsInfo.length === 0) {
    return;
  }

  // 获取鼠标在Canvas中的坐标
  const canvasX = mouseX;
  const canvasY = mouseY;

  // 查找点击的色块（遍历所有色块，检查是否在点击范围内）
  let clickedIndex = -1;
  for (let i = 0; i < rectsInfo.length; i++) {
    const info = rectsInfo[i];
    if (canvasX >= info.x && canvasX <= info.x + info.w && canvasY >= info.y && canvasY <= info.y + info.h) {
      clickedIndex = i;
      break;
    }
  }

  // 如果找到了色块，更新信息栏
  if (clickedIndex >= 0) {
    selectedMovieIndex = clickedIndex;
    
    // 触发重绘以显示选中效果
    redraw();
    
    // 显示悬浮提示框
    showTooltip(mouseX, mouseY, rectsInfo[clickedIndex]);

    // 添加调试日志
    fetch('http://127.0.0.1:7242/ingest/947d3c17-21a3-40a3-9d2a-3a3abbc19a0f', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'sketch.js:1999', message: 'Overview mode click detected', data: { clickedIndex, canvasX, canvasY, rectX: rectsInfo[clickedIndex].x, rectY: rectsInfo[clickedIndex].y, rectW: rectsInfo[clickedIndex].w, rectH: rectsInfo[clickedIndex].h, movieTitle: rectsInfo[clickedIndex].row.getString('primaryTitle') }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => {});

    // 阻止事件冒泡，避免触发其他事件
    return false;
  } else {
    // 点击空白处，隐藏提示框
    hideTooltip();
    
    // 取消选中并重绘
    selectedMovieIndex = -1;
    redraw();
  }
}

// 显示悬浮提示框
function showTooltip(x, y, info) {
  let tooltip = document.getElementById('hover-tooltip');
  
  // 如果不存在，创建它
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'hover-tooltip';
    document.body.appendChild(tooltip);
  }
  
  const title = info.row.getString('primaryTitle');
  const year = info.row.getString('startYear');
  const views = info.row.getString('Views');
  const viewsFormatted = views ? parseFloat(views).toLocaleString() : 'N/A';
  const genres = info.row.getString('genres');
  
  tooltip.innerHTML = `
    <div class="tooltip-title">${title}</div>
    <div class="tooltip-meta">${year}</div>
    <div class="tooltip-genres">${genres}</div>
    <div class="tooltip-views">${viewsFormatted} views</div>
  `;
  
  // 先显示出来但不可见，以便计算尺寸
  tooltip.style.display = 'block';
  tooltip.style.visibility = 'hidden';
  
  // 获取实际尺寸
  const rect = tooltip.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  const offset = 15;
  const padding = 10; // 屏幕边缘留白

  let left = x + offset;
  let top = y + offset;
  
  // 水平方向检测：优先显示在右侧，如果放不下就移动到屏幕内
  if (left + w > window.innerWidth - padding) {
    // 尝试放在左侧
    left = x - w - offset;
    
    // 如果左侧也放不下（比如手机屏幕太窄），则强制限制在屏幕范围内
    if (left < padding) {
      // 如果屏幕足够宽，优先靠右对齐屏幕
      if (window.innerWidth > w + padding * 2) {
        left = window.innerWidth - w - padding;
      } else {
        // 屏幕极窄，居中显示
        left = (window.innerWidth - w) / 2;
      }
    }
  }
  
  // 垂直方向检测：优先显示在下方，如果放不下尝试上方
  if (top + h > window.innerHeight - padding) {
    top = y - h - offset;
    
    // 如果上方也放不下（极少情况），则强制顶端对齐
    if (top < padding) {
      top = padding;
    }
  }
  
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
  tooltip.style.opacity = '1';
  tooltip.style.visibility = 'visible';
}

// 隐藏悬浮提示框
function hideTooltip() {
  const tooltip = document.getElementById('hover-tooltip');
  if (tooltip) {
    tooltip.style.display = 'none';
    tooltip.style.opacity = '0';
    tooltip.style.visibility = 'hidden';
  }
}

// Handle window resize events
function windowResized() {
  // Resize canvas to match new window dimensions
  resizeCanvas(windowWidth, windowHeight);
  
  // Recalculate layout based on new height
  calculateMainLayout();
  
  // Update spacer width for scrolling
  let totalWidth = 0;
  if (rectsInfo.length > 0) {
    const lastRect = rectsInfo[rectsInfo.length - 1];
    totalWidth = lastRect.x + lastRect.w;
  }
  
  const spacer = document.getElementById('scroll-spacer');
  if (spacer) {
    spacer.style.width = totalWidth + 'px';
  }
  
  // Also update the intro bars if they exist, to match the new scale
  generateIntroBars();
  
  // Trigger redraw
  redraw();
  
  print(`Window resized to ${windowWidth}x${windowHeight}`);
}
