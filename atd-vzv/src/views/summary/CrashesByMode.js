import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Bar } from "react-chartjs-2";
import { Container, Row, Col } from "reactstrap";

import CrashTypeSelector from "../nav/CrashTypeSelector";
import { colors } from "../../constants/colors";
import {
  dataEndDate,
  yearsArray,
  summaryCurrentYearEndDate,
} from "../../constants/time";
import { crashEndpointUrl } from "./queries/socrataQueries";

const CrashesByMode = () => {

  const modes = [
    {
      label: "Motorist",
      fields: {
        fatal: `motor_vehicle_death_count`,
        injury: `motor_vehicle_serious_injury_count`,
      },
    },
    {
      label: "Pedestrian",
      fields: {
        fatal: `pedestrian_death_count`,
        injury: `pedestrian_serious_injury_count`,
      },
    },
    {
      label: "Motorcyclist",
      fields: {
        fatal: `motorcycle_death_count`,
        injury: `motorcycle_serious_injury_count`,
      },
    },
    {
      label: "Bicyclist",
      fields: {
        fatal: `bicycle_death_count`,
        injury: `bicycle_serious_injury_count`,
      },
    },
    {
      label: "Other",
      fields: {
        fatal: `other_death_count`,
        injury: `other_serious_injury_count`,
      },
    },
  ];

  const chartColors = [
    colors.viridis1Of6Highest,
    colors.viridis2Of6,
    colors.viridis3Of6,
    colors.viridis4Of6,
    colors.viridis5Of6,
  ];

  const [chartData, setChartData] = useState(null); // {yearInt: [{record}, {record}, ...]}
  const [crashType, setCrashType] = useState([]);
  const chartRef = useRef();


  // Fetch data and set in state by years in yearsArray
  useEffect(() => {
    // Wait for crashType to be passed up from setCrashType component
    if (crashType.queryStringPerson) {
      const getChartData = async () => {
        let newData = {};
        // Use Promise.all to let all requests resolve before setting chart data by year
        await Promise.all(
          yearsArray().map(async (year) => {
            // If getting data for current year (only including years past January), set end of query to last day of previous month,
            // else if getting data for previous years, set end of query to last day of year
            let endDate =
              year.toString() === dataEndDate.format("YYYY")
                ? `${summaryCurrentYearEndDate}T23:59:59`
                : `${year}-12-31T23:59:59`;
            let url = `${crashEndpointUrl}?$where=${crashType.queryStringCrash} AND crash_date between '${year}-01-01T00:00:00' and '${endDate}'`;
            await axios.get(url).then((res) => {
              newData = { ...newData, ...{ [year]: res.data } };
            });
            return null;
          })
        );
        setChartData(newData);
      };
      getChartData();
    }
  }, [crashType]);

  const createChartLabels = () => yearsArray().map((year) => `${year}`);

  // Tabulate fatalities/injuries by mode fields in data
  const getModeData = (fields) =>
    yearsArray().map((year) => {
      return chartData[year].reduce((accumulator, record) => {
        const isFatalQuery =
          crashType.name === "fatalities" ||
          crashType.name === "fatalitiesAndSeriousInjuries";
        const isInjuryQuery =
          crashType.name === "seriousInjuries" ||
          crashType.name === "fatalitiesAndSeriousInjuries";

        accumulator += isFatalQuery && parseInt(record[fields.fatal]);
        accumulator += isInjuryQuery && parseInt(record[fields.injury]);

        return accumulator;
      }, 0);
    });

  // Sort mode order in stack and apply colors by averaging total mode fatalities across all years in chart
  const sortAndColorModeData = (modeData) => {
    const averageModeFatalities = (modeDataArray) =>
      modeDataArray.reduce((a, b) => a + b) / modeDataArray.length;
    const modeDataSorted = modeData.sort(
      (a, b) => averageModeFatalities(b.data) - averageModeFatalities(a.data)
    );
    modeDataSorted.forEach((category, i) => {
      const color = chartColors[i];
      category.backgroundColor = color;
      category.borderColor = color;
      category.hoverBackgroundColor = color;
      category.hoverBorderColor = color;
    });
    return modeDataSorted;
  };

  // Create dataset for each mode type, data property is an array of fatality sums sorted chronologically
  const createTypeDatasets = () => {
    const modeData = modes.map((mode) => ({
      borderWidth: 2,
      label: mode.label,
      data: getModeData(mode.fields),
    }));
    // Determine order of modes in each year stack and color appropriately
    return sortAndColorModeData(modeData);
  };

  const data = {
    labels: createChartLabels(),
    datasets: !!chartData && createTypeDatasets(),
  };

  return (
    <Container className="m-0 p-0">
      <Row>
        <Col>
          <h2 className="text-left, font-weight-bold">By Mode</h2>
        </Col>
      </Row>
      <Row>
        <Col>
          <CrashTypeSelector setCrashType={setCrashType} />
        </Col>
      </Row>
      <Row>
        <Col>
          <hr />
        </Col>
      </Row>
      <Row className="mt-1">
        <Col>
          <Bar
            ref={(ref) => (chartRef.current = ref)}
            data={data}
            height={null}
            width={null}
            options={{
              // responsive: true,
              // aspectRatio: 1,
              // maintainAspectRatio: false,
              scales: {
                xAxes: [
                  {
                    stacked: true,
                  },
                ],
                yAxes: [
                  {
                    stacked: true,
                  },
                ],
              },
              legendCallback: function(chart) {
                // console.log(chart.data);
                // {!!chartData &&
                //   [...chartYearsArray].reverse().map((year, i) => {
                //     const yearTotalData = chartData[year];
                //     const yearTotal = yearTotalData[yearTotalData.length - 1];
                //     // Reverse data and colors arrays and render so they appear chronologically
                //     return (
                //       <Row>
                //         <Col xs={4} s={2} m={2} l={2} xl={2} key={i}>
                //           <StyledDiv>
                //             <div className="year-total-div">
                //               <hr
                //                 className="my-1"
                //                 style={{
                //                   border: `2px solid ${[...chartColors].reverse()[i]}`,
                //                 }}
                //               ></hr>
                //               <h6 className="text-center py-1 mb-0">
                //                 <strong>{!!chartData && year}</strong>
                //               </h6>
                //               <hr className="my-1"></hr>
                //               <h6 className="text-center py-1">
                //                 {!!chartData && yearTotal}
                //               </h6>
                //             </div>
                //           </StyledDiv>
                //         </Col>
                //       </Row>
                //     );
                //   })}
              }
            }}
          />
          {/* {!!chartRef.current && console.log(chartRef.current)}; */}
          {!!chartRef.current && chartRef.current.chartInstance.generateLegend()}
        </Col>
      </Row>
    </Container>
  );
};

export default CrashesByMode;
