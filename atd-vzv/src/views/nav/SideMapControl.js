import React, { useEffect, useState } from "react";
import { StoreContext } from "../../utils/store";
import "react-infinite-calendar/styles.css";

import SideMapControlDateRange from "./SideMapControlDateRange";
import SideMapControlOverlays from "./SideMapControlOverlays";
import { colors } from "../../constants/colors";
import { otherFiltersArray } from "../../constants/filters";
import { ButtonGroup, Button, Card, Label } from "reactstrap";
import styled from "styled-components";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faWalking,
  faBiking,
  faCar,
  faMotorcycle
} from "@fortawesome/free-solid-svg-icons";

const StyledCard = styled.div`
  font-size: 1.2em;

  .card-title {
    font-weight: bold;
    color: ${colors.white};
  }

  .section-title {
    font-size: 1em;
    color: ${colors.dark};
  }

  .card-body {
    background: ${colors.white};
  }
`;

const SideMapControl = () => {
  const {
    mapFilters: [filters, setFilters]
  } = React.useContext(StoreContext);

  const [filterGroupCounts, setFilterGroupCounts] = useState({});

  // Build filter string for Other modes
  const buildOtherFiltersString = () =>
    otherFiltersArray
      .reduce((accumulator, filterString) => {
        accumulator.push(`${filterString} = "Y"`);
        return accumulator;
      }, [])
      .join(" OR ");

  // Define groups of map filters
  const mapFilters = {
    mode: {
      pedestrian: {
        icon: faWalking,
        syntax: `pedestrian_fl = "Y"`,
        type: `where`,
        operator: `OR`
      },
      pedalcyclist: {
        icon: faBiking,
        syntax: `pedalcyclist_fl = "Y"`,
        type: `where`,
        operator: `OR`
      },
      motor: {
        icon: faCar,
        syntax: `motor_vehicle_fl = "Y"`,
        type: `where`,
        operator: `OR`
      },
      motorcycle: {
        icon: faMotorcycle,
        syntax: `motorcycle_fl = "Y"`,
        type: `where`,
        operator: `OR`
      },
      other: {
        text: "Other",
        syntax: buildOtherFiltersString(),
        type: `where`,
        operator: `OR`
      }
    },
    type: {
      seriousInjury: {
        text: `Injury`,
        syntax: `sus_serious_injry_cnt > 0`,
        type: `where`,
        operator: `OR`
      },
      fatal: {
        text: `Fatal`,
        syntax: `apd_confirmed_death_count > 0`,
        type: `where`,
        operator: `OR`
      }
    }
  };

  // Reduce all filters and set active filters (apply all filters on render)
  useEffect(() => {
    const initialFiltersArray = Object.entries(mapFilters).reduce(
      (accumulator, [type, filters]) => {
        const groupFilters = Object.entries(filters).reduce(
          (accumulator, [name, filterConfig]) => {
            filterConfig["name"] = name;
            filterConfig["group"] = type;
            accumulator.push(filterConfig);
            return accumulator;
          },
          []
        );
        accumulator = [...accumulator, ...groupFilters];
        return accumulator;
      },
      []
    );
    setFilters(initialFiltersArray);
  }, []);

  useEffect(() => {
    const filtersCount = filters.reduce((accumulator, filter) => {
      if (accumulator[filter.group]) {
        accumulator = {
          ...accumulator,
          [filter.group]: accumulator[filter.group] + 1
        };
      } else {
        accumulator = { ...accumulator, [filter.group]: 1 };
      }
      return accumulator;
    }, {});
    setFilterGroupCounts(filtersCount);
  }, [filters]);

  const handleFilterClick = (event, filterGroup) => {
    // Set filter or remove if already set
    const filterName = event.currentTarget.id;

    if (isFilterSet(filterName)) {
      // if there is at least one type of each filter set, remove, else don't!
      const updatedFiltersArray = filters.filter(
        setFilter => setFilter.name !== filterName
      );
      setFilters(updatedFiltersArray);
    } else {
      const filter = mapFilters[filterGroup][filterName];
      // Add filterName and group to object for IDing and grouping
      filter["name"] = filterName;
      filter["group"] = filterGroup;
      const filtersArray = [...filters, filter];
      setFilters(filtersArray);
    }
  };

  const isFilterSet = filterName => {
    return !!filters.find(setFilter => setFilter.name === filterName);
  };

  return (
    <StyledCard>
      <div className="card-title">Traffic Crashes</div>
      <Card className="p-3 card-body">
        <Label className="section-title">Filters</Label>
        {/* Create a button group for each group of mapFilters */}
        {Object.entries(mapFilters).map(([group, groupParameters], i) => (
          <ButtonGroup key={i} className="mb-3 d-flex" id={`${group}-buttons`}>
            {/* Create buttons for each filter within a group of mapFilters */}
            {Object.entries(groupParameters).map(([name, parameter], i) => (
              <Button
                key={i}
                id={name}
                color="info"
                className="w-100 pt-1 pb-1 pl-0 pr-0"
                onClick={event => handleFilterClick(event, group)}
                active={isFilterSet(name)}
                outline={!isFilterSet(name)}
              >
                {parameter.icon && (
                  <FontAwesomeIcon
                    icon={parameter.icon}
                    className="mr-1 ml-1"
                  />
                )}
                {parameter.text}
              </Button>
            ))}
          </ButtonGroup>
        ))}
        <SideMapControlDateRange />
      </Card>
      <SideMapControlOverlays />
    </StyledCard>
  );
};

export default SideMapControl;
