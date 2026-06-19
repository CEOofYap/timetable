/// <reference lib="dom" />

document.addEventListener("alpine:init", () => {
    document.documentElement.setAttribute("data-theme", "light");
    Alpine.data("timetableApp", () => ({
        number: 20,
        name: "mario",
        theme: "Light",
    }));
});

// example data
// {
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
//   }
