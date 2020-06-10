import React from "react";
import { withApollo } from "react-apollo";
import moment from "moment";

import GridTable from "../../Components/GridTable";
import gqlAbstract from "../../queries/gqlAbstract";
import { locationQueryExportFields } from "../../queries/Locations";

// Our initial query configuration
let queryConf = {
  table: "atd_txdot_locations",
  single_item: "locations",
  showDateRange: false,
  columns: {
    location_id: {
      primary_key: true,
      searchable: true,
      sortable: true,
      label_search: "Search by location id",
      label_table: "Location ID",
      type: "Integer",
    },
    description: {
      searchable: true,
      sortable: false,
      label_search: "Search by intersecting street name",
      label_table: "Location",
      type: "String",
    },
    "crashes_count_cost_summary { total_crashes }": {
      searchable: false,
      sortable: true,
      label_search: null,
      label_table: "Total Crashes",
      default: 0,
      type: "Integer",
    },
    "crashes_count_cost_summary { total_deaths }": {
      searchable: false,
      sortable: true,
      label_search: null,
      label_table: "Total Deaths (CRIS)",
      default: 0,
      type: "Integer",
    },
    "crashes_count_cost_summary { total_serious_injuries }": {
      searchable: false,
      sortable: true,
      label_search: null,
      label_table: "Total Suspected Serious Injuries",
      default: 0,
      type: "Integer",
    },
    "crashes_count_cost_summary { est_comp_cost }": {
      searchable: false,
      sortable: true,
      label_search: null,
      label_table: "Total Est Comp. Cost", // Both CR3 + Blueform
      default: 0,
      type: "Currency",
    },
  },
  order_by: {},
  where: {
    // Only show Locations inside CoA Limits.
    council_district: "_gt: 0",
  },
  limit: 25,
  offset: 0,
};

const dateRangeStart = moment()
  .subtract(5, "years")
  .format("MM/DD/YYYY");
const dateRangeEnd = moment().format("MM/DD/YYYY");
const helperText = `Totals calculated using the previous five years of crash data (${dateRangeStart} - ${dateRangeEnd})`;

let locationsQuery = new gqlAbstract(queryConf);

const Locations = () => (
  <GridTable
    query={locationsQuery}
    title={"Locations"}
    columnsToExport={locationQueryExportFields}
    helperText={helperText}
  />
);

export default withApollo(Locations);
