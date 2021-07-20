import React from "react";
import { withApollo } from "react-apollo";

import GridTable from "../../Components/GridTable";
import gqlAbstract from "../../queries/gqlAbstract";
import { crashQueryExportFields } from "../../queries/crashes";
import {
  crashGridTableColumns,
  crashGridTableAdvancedFilters,
} from "./crashGridTableParameters";

// Our initial query configuration
let queryConf = {
  table: "atd_txdot_crashes",
  single_item: "crashes",
  showDateRange: true,
  columns: crashGridTableColumns,
  order_by: {},
  where: {},
  limit: 25,
  offset: 0,
};

let crashesQuery = new gqlAbstract(queryConf);

let customFilters = crashGridTableAdvancedFilters;

const Crashes = () => (
  <GridTable
    query={crashesQuery}
    title={"Crashes"}
    filters={customFilters}
    columnsToExport={crashQueryExportFields}
  />
);

export default withApollo(Crashes);
