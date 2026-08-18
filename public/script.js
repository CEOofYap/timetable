/// <reference lib="dom" />

document.addEventListener("DOMContentLoaded", () => {
    const themeSelector = document.getElementById("theme-selector");
    const savedTheme = localStorage.getItem("theme");

    if (savedTheme) {
        themeSelector.value = savedTheme;
    }

    themeSelector.addEventListener("change", (e) => {
        localStorage.setItem("theme", e.target.value);
    });
});

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
    const d = DAY_MAP[classSlot.DAY];
    const date = new Date(classSlot.DATESTAMP_ISO);

    const daysToSubtract = d - 1;

    date.setDate(date.getDate() - daysToSubtract);
    return date;
}

// Get monday
function getMonday(classSlots) {
    const uniqueMondays = [];

    classSlots.forEach((slot) => {
        const monday = getWeek(slot);

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
        return [];
    }
}

document.addEventListener("alpine:init", () => {
    Alpine.data("timetableApp", () => ({
        selectedDay: "",
        selectedWeek: "",
        days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        newPerson: { name: "", course: "", group: "" },
        people: [],
        allIntakes: {},
        weeks: null,
        precompute: null,
        freetime: [[8, 21]],
        showFreetime: true,
        showIntakeDropdown: false,
        showGroupDropdown: false,
        selectedPerson: null,

        init() {
            this.fetchTimetable();
            this.people = loadLocal("people");
            this.$watch("selectedDay", (value) => {
                this.resetFreetime();
                this.recalcFreetime();
                this.restartAnimations();
            });
            this.$watch("selectedWeek", (value) => {
                this.resetFreetime();
                this.recalcFreetime();
                this.restartAnimations();
            });
            this.$watch("showFreetime", (value) => {
                this.recalcFreetime();
            });
            document.addEventListener("click", (e) => {
                this.handleGlobalClick(e);
            });
        },

        async fetchTimetable() {
            try {
                const rawData = await fetchJson(API_ROUTE);

                const sortedClasses = sortTimetable(rawData);
                this.precompute = computeClassMap(sortedClasses);
                this.weeks = getMonday(sortedClasses);

                if (rawData && rawData.length > 0) {
                    this.allIntakes = rawData.reduce(
                        (accumulator, currentItem) => {
                            const intakeCode = currentItem["INTAKE"];
                            const group = currentItem["GROUPING"];

                            if (!accumulator[intakeCode]) {
                                accumulator[intakeCode] = new Set();
                            }

                            accumulator[intakeCode].add(group);
                            return accumulator;
                        },
                        {},
                    );
                }
            } catch (e) {
                console.log("Failed to get timetable from APU", e);
            }
        },

        handleGlobalClick(e) {
            // Don't deselect if clicking on interactive elements
            const interactiveElements = [
                "INPUT",
                "BUTTON",
                "TEXTAREA",
                "SELECT",
                "LABEL",
            ];

            // Check if clicked element is interactive or inside one
            let target = e.target;
            while (target && target !== document.body) {
                if (interactiveElements.includes(target.tagName)) {
                    return; // Don't deselect
                }
                // Also check if it's inside the form or person list
                if (
                    target.classList.contains("retro-window-content") ||
                    target.classList.contains("person-item") ||
                    target.classList.contains("person-tag") ||
                    target.closest(".retro-window-content") ||
                    target.closest(".person-item") ||
                    target.closest(".person-tag")
                ) {
                    return; // Don't deselect
                }
                target = target.parentElement;
            }

            // If we got here, it's a background click
            this.deselectPerson();
        },

        savePerson() {
            if (
                this.newPerson.name &&
                this.newPerson.course &&
                this.newPerson.group
            ) {
                const personData = {
                    name: this.newPerson.name,
                    course: this.newPerson.course.toUpperCase(),
                    group: this.newPerson.group.toUpperCase(),
                };
                // update ppl
                if (this.selectedPerson !== null) {
                    this.people[this.selectedPerson] = personData;
                } else {
                    // add into people
                    this.people.push(personData);
                }
                this.newPerson = {
                    name: "",
                    course: "",
                    group: "",
                };
                saveLocal("people", this.people);
                this.selectedPerson = null;
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
            // check if the person removed is same as the selected person
            if (this.selectedPerson === index) {
                this.selectedPerson = null;
                this.resetForm();
            }
            this.people.splice(index, 1);
            saveLocal("people", this.people);
            // remove free time
            this.resetFreetime();
        },

        selectPerson(index) {
            const SelectedP = this.people[index];
            this.newPerson = {
                name: SelectedP.name,
                course: SelectedP.course,
                group: SelectedP.group,
            };
            this.selectedPerson = index;
        },

        deselectPerson() {
            if (this.selectedPerson === null) {
                return;
            }
            this.selectedPerson = null;
            this.resetForm();
        },

        get selectedDate() {
            // Check if day or week are selected
            if (!this.selectedDay || !this.selectedWeek) {
                return null;
            }
            const d = DAY_MAP[this.selectedDay];

            const daysToAdd = d - 1;
            const selected = new Date(this.selectedWeek);
            selected.setDate(selected.getDate() + daysToAdd);
            return selected;
        },

        getColumnWidth() {
            const cols = this.$refs.cols;

            // 1. If the ref doesn't exist yet, return fallback
            if (!cols) {
                return 100;
            }

            // 2. Safely extract the first element.
            // If it's an array, grab [0]. If it's already a single element, just use it.
            const firstCol = Array.isArray(cols) ? cols[0] : cols;

            // 3. Final safety check before measuring
            if (!firstCol) return 100;

            return firstCol.getBoundingClientRect().width;
        },

        // "YYYY-MM-DD" in UTC, matching the API's DATESTAMP_ISO format
        dateKey(date) {
            return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
        },

        // Helper to parse "8:30 AM" into 8.5
        parseTime(timeStr) {
            if (!timeStr) return 0;
            const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (!match) return 0;
            let hours = parseInt(match[1]);
            const minutes = parseInt(match[2]);
            const period = match[3].toUpperCase();

            if (period === "PM" && hours !== 12) hours += 12;
            if (period === "AM" && hours === 12) hours = 0;

            return hours + minutes / 60;
        },

        slotStyles(startDecimal, endDecimal) {
            const colWidth = this.getColumnWidth();

            // How many hours past 8:00 AM the slot starts (fractional part)
            const hoursFromStart = startDecimal - Math.floor(startDecimal);
            const duration = endDecimal - startDecimal;

            return `left: ${hoursFromStart * colWidth}px; width: ${duration * colWidth}px;`;
        },

        getEventStyles(startTime, endTime) {
            return this.slotStyles(
                this.parseTime(startTime),
                this.parseTime(endTime),
            );
        },

        getFreetimeStyles(startDecimal, endDecimal) {
            return this.slotStyles(startDecimal, endDecimal);
        },

        // Determine whether the column got class or not
        haveClass(col, person) {
            return this.getClass(col, person) != null;
        },

        getClass(col, person) {
            if (!this.selectedDate) {
                return null;
            }

            const course = person.course;
            const group = person.group;
            const dateStr = this.dateKey(this.selectedDate);
            const classes = this.precompute
                ?.get(course)
                ?.get(group)
                ?.get(dateStr);

            if (!classes) {
                return null;
            }

            // Go through every class on that day and determine if theres any class on the specific column
            return (
                classes.find((slot) => {
                    const slotHour = Math.floor(this.parseTime(slot.TIME_FROM));
                    return slotHour - 6 === col;
                }) ?? null
            );
        },

        cutTime(startTime, endTime) {
            const startDecimal = this.parseTime(startTime);
            const endDecimal = this.parseTime(endTime);

            const newFreeTime = [];
            this.freetime.forEach((section) => {
                const sectionStart = section[0];
                const sectionEnd = section[1];

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

            const dateStr = this.dateKey(this.selectedDate);
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
            const slots = this.activeSlots;
            slots.forEach((slot) => {
                this.cutTime(slot.TIME_FROM, slot.TIME_TO);
            });
        },

        recalcFreetime() {
            if (this.showFreetime && this.selectedDate) {
                this.calcFreetime();
            }
        },

        resetFreetime() {
            this.freetime = [[8, 21]];
        },

        get filteredIntakes() {
            const unique = Object.keys(this.allIntakes);
            if (!this.newPerson.course) return unique;

            return unique.filter((intake) =>
                intake
                    .toLowerCase()
                    .includes(this.newPerson.course.toLowerCase()),
            );
        },

        get filteredGroups() {
            const groups = [...(this.allIntakes[this.newPerson.course] || [])];

            if (!this.newPerson.group) return groups.sort();

            return groups
                .filter((group) =>
                    group
                        .toLowerCase()
                        .includes(this.newPerson.group.toLowerCase()),
                )
                .sort();
        },

        selectIntake(code) {
            this.newPerson.course = code;
            this.showIntakeDropdown = false;
        },

        selectGroup(code) {
            this.newPerson.group = code;
            this.showGroupDropdown = false;
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
