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

        const options = { day: "2-digit", month: "short", year: "numeric" };
        const mondayString = monday
            .toLocaleDateString("en-GB", options)
            .replace(",", "");

        const lastSavedMonday = uniqueMondays[uniqueMondays.length - 1];

        if (lastSavedMonday !== mondayString) {
            uniqueMondays.push(mondayString);
        }
    });

    return uniqueMondays;
}

document.addEventListener("alpine:init", () => {
    document.documentElement.setAttribute("data-theme", "light");
    Alpine.data("timetableApp", () => ({
        theme: "light",
        selectedDay: "",
        selectedWeek: "",
        days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        weeks: null,
        newPerson: { name: "", course: "", group: "" },
        people: [],
        timetable: null,

        init() {
            this.fetchTimetable();
        },

        async fetchTimetable() {
            try {
                const rawData = await fetchJson(API_ROUTE);

                this.timetable = sortTimetable(rawData);
                this.weeks = getMonday(this.timetable);
            } catch (e) {
                console.log("Failed to get timetable from APU", e);
            }
        },

        testing() {
            console.log("Week");
            console.log("Last item = ", this.timetable.at(-1));
            console.log(this.weeks);
        },
    }));
});

// 1. Get the monday of this week as the first week
// 2. Sort it first
// 3. Load the monday of the last class in the data
// 4. Fill in the blank

// 1. Aggregate the classes by each week
// 2.

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
