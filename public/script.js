/// <reference lib="dom" />

const API_ROUTE =
    "https://s3-ap-southeast-1.amazonaws.com/open-ws/weektimetable";
const DAY_MAP = {
    MON: 1,
    TUE: 2,
    WED: 3,
    THU: 4,
    FRI: 5,
    SAT: 6,
    SUN: 7,
};

async function fetchJson(url) {
    return fetch(url).then((r) => {
        if (!r.ok) throw new Error("Fetch failed: " + r.status);
        return r.json();
    });
}

// sort timetable
function sortTimetable(timetable) {
    // Safety check: If the API returned an object instead of an array, this will catch it
    if (!Array.isArray(timetable)) {
        console.error("Timetable is not an array! It is:", timetable);
        return timetable;
    }

    // Create an ACTUAL copy of the array
    const newTimetable = [...timetable];

    newTimetable.sort((a, b) => {
        return new Date(a.DATESTAMP_ISO) - new Date(b.DATESTAMP_ISO);
    });

    return newTimetable;
}

function getWeek(classSlot) {
    d = DAY_MAP[classSlot.DAY];
    date = new Date(classSlot.DATESTAMP_ISO);

    const daysToSubtract = d - 1;

    date.setDate(date.getDate() - daysToSubtract);
    return date;
}

// Get monday
function getMonday(classSlots) {
    uniqueMondays = [];

    classSlots.forEach((slot) => {
        monday = getWeek(slot);

        const lastSavedMonday = uniqueMondays[uniqueMondays.length - 1];

        const isSameDay =
            lastSavedMonday &&
            lastSavedMonday.toDateString() === monday.toDateString();

        if (!isSameDay) {
            uniqueMondays.push(monday);
        }
    });

    return uniqueMondays;
}
// Convert an array of date to locale string
function convertDate(dates) {
    output = [];
    const options = { day: "2-digit", month: "short", year: "numeric" };

    dates.forEach((date) => {
        const dateString = date
            .toLocaleDateString("en-GB", options)
            .replace(",", "");
        output.push(dateString);
    });

    return output;
}

function computeClassMap(sortedClassSlots) {
    const computedClass = new Map();

    sortedClassSlots.forEach((slot) => {
        const intake = slot.INTAKE;
        const date = slot.DATESTAMP_ISO;
        const group = slot.GROUPING;
        // Check if the computed alr have the intake
        let groupMap = computedClass.get(intake);
        if (!groupMap) {
            groupMap = new Map();
            computedClass.set(intake, groupMap);
        }
        // check if alr have group
        let dateMap = groupMap.get(group);
        if (!dateMap) {
            dateMap = new Map();
            groupMap.set(group, dateMap);
        }
        // Check if alr have date
        let classArray = dateMap.get(date);
        if (!classArray) {
            classArray = [];
            dateMap.set(date, classArray);
        }
        classArray.push(slot);
    });
    return computedClass;
}

function saveLocal(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function loadLocal(key) {
    try {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw);
        return [];
    } catch (e) {
        console.warn("Failed to load ", key, e);
    }
}

document.addEventListener("alpine:init", () => {
    document.documentElement.setAttribute("data-theme", "light");
    Alpine.data("timetableApp", () => ({
        theme: "light",
        selectedDay: "",
        selectedWeek: "",
        days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        newPerson: { name: "", course: "", group: "" },
        people: [],
        sortedClasses: null,
        uniqueIntakes: [],
        weeks: null,
        precompute: null,
        freetime: [[8, 18]],
        showFreetime: false,
        showIntakeDropdown: false,

        init() {
            this.fetchTimetable();
            this.people = loadLocal("people");
            this.$watch("selectedDay", (value) => {
                this.resetFreetime();
                this.restartAnimations();
            });
            this.$watch("selectedWeek", (value) => {
                this.resetFreetime();
                this.restartAnimations();
            });
        },

        async fetchTimetable() {
            try {
                const rawData = await fetchJson(API_ROUTE);

                this.sortedClasses = sortTimetable(rawData);
                this.precompute = computeClassMap(this.sortedClasses);
                this.weeks = getMonday(this.sortedClasses);

                if (rawData && rawData.length > 0) {
                    // 1. Map all intakes, trim whitespace (your data has a leading space!)
                    const allIntakes = rawData.map((slot) =>
                        slot.INTAKE.trim(),
                    );

                    // 2. Use a Set to remove duplicates, then convert back to array and sort
                    this.uniqueIntakes = [...new Set(allIntakes)].sort();
                }
            } catch (e) {
                console.log("Failed to get timetable from APU", e);
            }
        },

        addPerson() {
            if (
                this.newPerson.name &&
                this.newPerson.course &&
                this.newPerson.group
            ) {
                // Add into people
                this.people.push({
                    name: this.newPerson.name,
                    course: this.newPerson.course.toUpperCase(),
                    group: this.newPerson.group.toUpperCase(),
                });
                this.newPerson = {
                    name: "",
                    course: "",
                    group: "",
                };
                saveLocal("people", this.people);
                // remove free time
                this.resetFreetime();
            }
        },

        resetForm() {
            this.newPerson = {
                name: "",
                course: "",
                group: "",
            };
        },

        removePerson(index) {
            this.people.splice(index, 1);
            saveLocal("people", this.people);
            // remove free time
            this.resetFreetime();
        },

        get selectedDate() {
            // Check if day or week are selected
            if (!this.selectedDay || !this.selectedWeek) {
                return null;
            }
            d = DAY_MAP[this.selectedDay];

            daysToAdd = d - 1;
            selected = new Date(this.selectedWeek);
            selected.setDate(selected.getDate() + daysToAdd);
            return selected;
        },

        getColumnWidth() {
            const cols = this.$refs.cols;

            // 1. If the ref doesn't exist yet, return fallback
            if (!cols) {
                console.log("No col get");
                return 100;
            }

            // 2. Safely extract the first element.
            // If it's an array, grab [0]. If it's already a single element, just use it.
            const firstCol = Array.isArray(cols) ? cols[0] : cols;

            // 3. Final safety check before measuring
            if (!firstCol) return 100;

            return firstCol.getBoundingClientRect().width;
        },

        // Helper to parse "8:30 AM" into 8.5
        parseTime(timeStr) {
            if (!timeStr) return 0;
            const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
            let hours = parseInt(match[1]);
            const minutes = parseInt(match[2]);
            const period = match[3].toUpperCase();

            if (period === "PM" && hours !== 12) hours += 12;
            if (period === "AM" && hours === 12) hours = 0;

            return hours + minutes / 60;
        },

        getEventStyles(startTime, endTime) {
            const colWidth = this.getColumnWidth();

            const startDecimal = this.parseTime(startTime);
            const endDecimal = this.parseTime(endTime);

            // Calculate how many hours past 8:00 AM the event starts
            const hoursFromStart = startDecimal - Math.floor(startDecimal);

            // Calculate total duration in hours
            const duration = endDecimal - startDecimal;

            // Multiply hours by the exact pixel width of the column
            const leftPixels = hoursFromStart * colWidth;
            const widthPixels = duration * colWidth;

            // Return the CSS string
            return `left: ${leftPixels}px; width: ${widthPixels}px;`;
        },

        getFreetimeStyles(startDecimal, endDecimal) {
            const colWidth = this.getColumnWidth();
            // Calculate how many hours past 8:00 AM the event starts
            const hoursFromStart = startDecimal - Math.floor(startDecimal);

            // Calculate total duration in hours
            const duration = endDecimal - startDecimal;

            // Multiply hours by the exact pixel width of the column
            const leftPixels = hoursFromStart * colWidth;
            const widthPixels = duration * colWidth;

            // Return the CSS string
            return `left: ${leftPixels}px; width: ${widthPixels}px;`;
        },

        // Determine whether the column got class or not
        haveClass(col, person) {
            if (!this.selectedDate) {
                return false;
            }

            const course = person.course;
            const group = person.group;
            const dateStr = this.selectedDate.toISOString().substring(0, 10);
            const classes = this.precompute
                ?.get(course)
                ?.get(group)
                ?.get(dateStr);

            if (!classes) {
                console.log("No class for this date", dateStr);
                return false;
            }

            // Go through every class on that day and determine if theres any class on the specific column
            return classes.some((slot) => {
                const slotHour = Math.floor(this.parseTime(slot.TIME_FROM));
                return slotHour - 6 === col;
            });
        },

        getClass(col, person) {
            if (!this.selectedDate) {
                return null;
            }

            const course = person.course;
            const group = person.group;
            const dateStr = this.selectedDate.toISOString().substring(0, 10);
            const classes = this.precompute
                ?.get(course)
                ?.get(group)
                ?.get(dateStr);

            if (!classes) {
                console.log("No class for this date", dateStr);
                return null;
            }

            // Go through every class on that day and determine if theres any class on the specific column
            return classes.find((slot) => {
                const slotHour = Math.floor(this.parseTime(slot.TIME_FROM));
                return slotHour - 6 === col;
            });
        },

        cutTime(startTime, endTime) {
            const startDecimal = this.parseTime(startTime);
            const endDecimal = this.parseTime(endTime);

            const newFreeTime = [];
            this.freetime.forEach((section) => {
                sectionStart = section[0];
                sectionEnd = section[1];

                // Check if start time inside the section
                if (startDecimal >= sectionStart && startDecimal < sectionEnd) {
                    // Check if end time inside the section
                    if (endDecimal < sectionEnd) {
                        // Add sectionStart to start and end to sectionEnd into newTime
                        newFreeTime.push([sectionStart, startDecimal]);
                        newFreeTime.push([endDecimal, sectionEnd]);
                    } else {
                        // Add old section but cut off until start
                        newFreeTime.push([sectionStart, startDecimal]);
                    }
                    // Check if the end time inside section
                } else if (
                    endDecimal > sectionStart &&
                    endDecimal <= sectionEnd
                ) {
                    // Trim off the front
                    newFreeTime.push([endDecimal, sectionEnd]);
                    // Check if the section is outside of start and end time
                } else if (
                    sectionStart >= endDecimal ||
                    sectionEnd <= startDecimal
                ) {
                    // Add into newFreeTime without changing anything
                    newFreeTime.push([sectionStart, sectionEnd]);
                }
            });
            this.freetime = newFreeTime;
        },

        get activeSlots() {
            if (!this.selectedDate || !this.people.length) return [];

            const dateStr = this.selectedDate.toLocaleDateString("en-CA"); // "YYYY-MM-DD"
            const allVisibleSlots = [];

            // Loop through every person currently in the sidebar
            this.people.forEach((person) => {
                const course = person.course;
                const group = person.group;

                // Safely grab the classes for this person on this specific date
                const classes =
                    this.precompute?.get(course)?.get(group)?.get(dateStr) ||
                    [];

                // Add them to our master list
                allVisibleSlots.push(...classes);
            });

            return allVisibleSlots;
        },

        haveFreetime(col) {
            if (!this.selectedDate) {
                return false;
            }
            const freetime = this.freetime;
            if (freetime.length === 0) {
                console.log("No free time for this date");
                return false;
            }

            // Go through every freetime on that day and determine if theres any class on the specific column
            return freetime.find((slot) => {
                const slotHour = Math.floor(slot[0]);
                return slotHour - 6 === col;
            });
        },

        getFreetime(col) {
            if (!this.selectedDate) {
                return null;
            }

            const freetime = this.freetime;
            if (freetime.length === 0) {
                return null;
            }

            // Go through every slot
            return freetime.find((slot) => {
                const slotHour = Math.floor(slot[0]);
                return slotHour - 6 === col;
            });
        },

        calcFreetime() {
            this.showFreetime = true;

            const slots = this.activeSlots;
            slots.forEach((slot) => {
                console.log("Cutting slot ", slot);
                this.cutTime(slot.TIME_FROM, slot.TIME_TO);
            });
        },

        resetFreetime() {
            this.freetime = [[8, 18]];
            this.showFreetime = false;
        },

        get filteredIntakes() {
            if (!this.newPerson.course) return this.uniqueIntakes;

            return this.uniqueIntakes.filter((intake) =>
                intake
                    .toLowerCase()
                    .includes(this.newPerson.course.toLowerCase()),
            );
        },

        selectIntake(code) {
            this.newPerson.course = code;
            this.showIntakeDropdown = false;
        },

        restartAnimations() {
            // Wait for Alpine to finish updating the DOM
            this.$nextTick(() => {
                document.querySelectorAll(".event-card").forEach((el) => {
                    // Remove the animation
                    el.style.animation = "none";
                    // Force a reflow (this is the magic trick!)
                    el.offsetHeight;
                    // Re-apply the animation (empty string restores the CSS rule)
                    el.style.animation = "";
                });
            });
        },

        testing() {
            console.log(this.freetime);
        },
    }));
});

// example data
// API route: https://s3-ap-southeast-1.amazonaws.com/open-ws/weektimetable
// [{
//     "INTAKE": " UCD2F2602ME",
//     "MODID": "AENG036-3-2-FPE-T-1",
//     "MODULE_NAME": "Fundamentals of Petroleum Engineering",
//     "DAY": "MON",
//     "LOCATION": "APU CAMPUS",
//     "ROOM": "B-06-02",
//     "LECTID": "MSF",
//     "NAME": "MUHAMMAD SAFRI BIN BASRUDDIN",
//     "SAMACCOUNTNAME": "safri.basruddin",
//     "DATESTAMP": "06-APR-26",
//     "DATESTAMP_ISO": "2026-04-06",
//     "TIME_FROM": "08:30 AM",
//     "TIME_TO": "10:30 AM",
//     "TIME_FROM_ISO": "2026-04-06T08:30:00+08:00",
//     "TIME_TO_ISO": "2026-04-06T10:30:00+08:00",
//     "GROUPING": "G1",
//     "CLASS_CODE": "G1",
//     "COLOR": "yellow"
//   },
// ]
