# Netflix Data Visualization Project

A creative, interactive data visualization exploring Netflix viewership trends. This project transforms raw data into an immersive visual experience, featuring dynamic rendering, genre-based color coding, and a "Liquid Glass" user interface.

## 📺 Live Demo
[Insert your GitHub Pages link here]

## ✨ Features

### 1. Interactive Visualization Modes
- **Timeline View (Browse Mode)**: A horizontal scrolling journey through the movie database. The width of each bar represents the viewership numbers, creating a visual rhythm of popularity.
- **Overview Mode**: A dense, grid-based view that allows users to see the entire dataset at a glance, revealing macro patterns in the catalog.

### 2. Dynamic Rendering Engine
- **Neon & Gradient Effects**: Custom rendering logic using p5.js to create vibrant, glowing visuals that mimic the cinematic feel of Netflix.
- **Genre Color Blending**: 
  - Movies with multiple genres have their colors dynamically blended.
  - **Warm Colors**: Action, Romance, Adventure.
  - **Bright Colors**: Comedy, Animation.
  - **Darker Tones**: Thriller, Horror.

### 3. Modern UI/UX
- **Liquid Glass Interface**: A frosted glass effect (Glassmorphism) for the bottom information bar, providing context without obscuring the visuals.
- **Responsive Design**: Fully optimized for both desktop and mobile devices.
- **Netflix Intro**: A recreation of the iconic Netflix intro animation using CSS/JS.

## 🛠 Technologies Used

- **Core**: HTML5, CSS3, JavaScript (ES6+)
- **Libraries**:
  - [p5.js](https://p5js.org/) - For the core visualization and canvas rendering.
  - [Three.js](https://threejs.org/) - Utilized for advanced graphical contexts.
- **Data**: CSV parsing and processing.

## 🚀 How to Run Locally

Due to browser security policies (CORS) regarding loading local CSV files, this project **cannot** be run simply by double-clicking `index.html`. You must use a local server.

### Option 1: VS Code (Recommended)
1. Install the **Live Server** extension in VS Code.
2. Right-click `index.html` and select "Open with Live Server".

### Option 2: Python
If you have Python installed, run this command in the project directory:
```bash
# Python 3
python -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

## 📦 Deployment

This project is configured to be easily deployed on **GitHub Pages**:

1. Upload this folder to a GitHub repository.
2. Go to the repository **Settings**.
3. Navigate to the **Pages** section.
4. Under **Source**, select `main` (or `master`) branch and `/ (root)` folder.
5. Click **Save**. Your site will be live in a few minutes!

## 📂 Project Structure

- `index.html`: Main entry point and structure.
- `sketch.js`: Core logic for data processing and p5.js visualization.
- `style.css`: Styling for the UI, including the glassmorphism effects and responsive layouts.
- `finalForm.csv`: The dataset containing Netflix movie information.
- `NetflixIntro/`: Contains assets and logic for the intro animation.

## 👤 Author

Project created for Parsons Data Visualization course.
