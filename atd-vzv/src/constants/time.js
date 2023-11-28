import moment from "moment";
import { sub, startOfYear, format, endOfYear, add } from "date-fns";

// Set the sliding window of data that feeds VZV
// Number of past years data to fetch
export const ROLLING_YEARS_OF_DATA = 4;
// Number of months window slides in the past (to display most accurate data)
// Accommodate for a preview instance that provide and extra month of data
export const MONTHS_AGO =
  process.env.REACT_APP_VZV_ENVIRONMENT === "PREVIEW" ? 1 : 2;

// Create array of ints of last n years
export const yearsArray = () => {
  let years = [];
  let year = parseInt(format(dataEndDate, "yyyy"));
  for (let i = 0; i <= ROLLING_YEARS_OF_DATA; i++) {
    years.unshift(year - i);
  }
  return years;
};

// First date of records that should be referenced in VZV (start of first year in rolling window)
// export const dataStartDate = moment()
//   .subtract(MONTHS_AGO, "month")
//   .subtract(ROLLING_YEARS_OF_DATA, "year")
//   .startOf("year");

export const dataStartDate = sub(startOfYear(new Date()), {
  months: MONTHS_AGO,
  years: ROLLING_YEARS_OF_DATA,
});

// Last date of records that should be referenced in VZV (the last day of the month that is MONTHS_AGO months ago)
// export const dataEndDate = moment().subtract(14, "day");

export const dataEndDate = sub(new Date(), { days: 14 });

// Summary time data
// export const summaryCurrentYearStartDate = dataEndDate
//   .clone() // Moment objects are mutable
//   .startOf("year")
//   .format("YYYY-MM-DD");
// export const summaryCurrentYearEndDate = dataEndDate.format("YYYY-MM-DD");

export const summaryCurrentYearStartDate = format(
  startOfYear(dataEndDate),
  "yyyy-MM-dd"
);
export const summaryCurrentYearEndDate = format(dataEndDate, "yyyy-MM-dd");

// export const summaryLastYearStartDate = dataEndDate
//   .clone()
//   .startOf("year")
//   .subtract(1, "year")
//   .format("YYYY-MM-DD");
// export const summaryLastYearEndDate = dataEndDate
//   .clone()
//   .subtract(1, "year")
//   .format("YYYY-MM-DD");

export const summaryLastYearStartDate = format(
  sub(startOfYear(dataEndDate), { years: 1 }),
  "yyyy-MM-dd"
);
export const summaryLastYearEndDate = format(
  sub(dataEndDate, { years: 1 }),
  "yyyy-MM-dddd"
);

export const currentYearString = summaryCurrentYearStartDate.slice(0, 4);
export const prevYearString = summaryLastYearStartDate.slice(0, 4);

// Map time data
export const mapStartDate = dataStartDate;

export const mapEndDate = dataEndDate;

// Five year average
// export const fiveYearAvgStartDate = dataEndDate
//   .clone()
//   .startOf("year")
//   .subtract(5, "year")
//   .format("YYYY-MM-DD");
// export const fiveYearAvgEndDate = dataEndDate
//   .clone()
//   .subtract(1, "year")
//   .endOf("year")
//   .format("YYYY-MM-DD");
export const fiveYearAvgStartDate = format(
  sub(startOfYear(dataEndDate), { years: 5 }),
  "yyyy-MM-dd"
);
export const fiveYearAvgEndDate = format(
  sub(endOfYear(dataEndDate), { years: 1 }),
  "yyyy-MM-dd"
);
// Unique variable for the byPop chart that prevents the edge case
// where the Feb. 1 query ends a year earlier than intended
// export const fiveYearAvgEndDateByPop = dataEndDate
//   .clone()
//   .add(1, "month")
//   .subtract(1, "year")
//   .endOf("year")
//   .format("YYYY-MM-DD");
export const fiveYearAvgEndDateByPop = format(
  endOfYear(sub(add(dataEndDate, { months: 1 }), { years: 1 })),
  "yyyy-MM-dd"
);

console.log(dataStartDate);
