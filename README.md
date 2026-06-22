# Timetable Comparison App

A dynamic timetable comparison application built with Alpine.js that allows users to visualize and compare class schedules, calculate free time, and find optimal meeting slots.

## Features

- **Multi-Person Schedule Comparison**: Add multiple people to compare their timetables side-by-side
- **Visual Timetable Grid**: Interactive weekly view with hour-by-hour columns (8 AM - 6 PM)
- **Smart Autocomplete**: Intake code autocomplete powered by real data from the API
- **Free Time Calculator**: Automatically calculates and displays free time slots based on all visible schedules
- **Persistent Storage**: Saves your people list to localStorage so it persists across sessions
- **Smooth Animations**: Event cards animate in/out when switching days or weeks (too lazy to do the animation for disappearing)
- **Responsive Design**: Adapts to different screen sizes with horizontal scrolling for the timetable grid (maybe idk)

## Tech Stack

- **Frontend Framework**: Alpine.js v3
- **Styling**: Custom CSS with CSS variables (no Tailwind)
- **Data Source**: APU Week Timetable API (https://s3-ap-southeast-1.amazonaws.com/open-ws/weektimetable)
- **Storage**: Browser localStorage

## Known Limitations

- I didn't make the ui for mobile so good luck if u using on phone
- LocalStorage has a ~5MB limit (shouldn't be an issue for this use case)
