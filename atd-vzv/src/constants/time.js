import moment from "moment";

// Number of past years data to fetch
// 4 full years of data, plus data up to the last complete month of the current year
export const ROLLING_YEARS_OF_DATA = 4;

// Create array of ints of last n years
export const yearsArray = () => {
  let years = [];
  let year = parseInt(dataEndDate.format("YYYY"));
  for (let i = 0; i <= ROLLING_YEARS_OF_DATA; i++) {
    years.unshift(year - i);
  }
  return years;
};

// First date of records that should be referenced in VZV (start of first year in rolling window)
export const dataStartDate = moment()
  .subtract(1, "month")
  .subtract(ROLLING_YEARS_OF_DATA, "year")
  .startOf("year");

// Last date of records that should be referenced in VZV (the last day of the month that is two months ago)
export const dataEndDate = moment().subtract(2, "month").endOf("month");

// Summary time data
export const summaryCurrentYearStartDate = dataEndDate
  .clone() // Moment objects are mutable
  .startOf("year")
  .format("YYYY-MM-DD");
export const summaryCurrentYearEndDate = dataEndDate.format("YYYY-MM-DD");

export const summaryLastYearStartDate = dataEndDate
  .clone()
  .startOf("year")
  .subtract(1, "year")
  .format("YYYY-MM-DD");
export const summaryLastYearEndDate = dataEndDate
  .clone()
  .subtract(1, "year")
  .format("YYYY-MM-DD");

export const currentYearString = summaryCurrentYearStartDate.slice(0, 4);
export const prevYearString = summaryLastYearStartDate.slice(0, 4);

// Map time data
export const mapStartDate = moment().subtract(1, "month").startOf("year");

export const mapEndDate = dataEndDate.clone();
