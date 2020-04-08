import React from "react";
import ColorSpinner from "../Spinner/ColorSpinner";
import {
  currentYearString as currentYear,
  prevYearString as prevYear,
  currentYearString,
} from "../../constants/time";

import { Card, CardBody, Row, Col, CardFooter } from "reactstrap";
import styled from "styled-components";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircle,
  faCaretDown,
  faCaretUp,
} from "@fortawesome/free-solid-svg-icons";
import { colors } from "../../constants/colors";

const SummaryWidget = ({ totalsObject, text, icon, backgroundColor }) => {
  const StyledWidget = styled.div`
    .total {
      font-size: 4em;
    }

    /* Shift icon left to align with Bootstrap card text */
    .widget-icon {
      position: relative;
      right: 5.25px;
    }

    .widget-footer {
      background: ${colors.white};
    }

    /* Center change icon in footer with .widget-icon above */
    .widget-change-icon {
      position: relative;
      left: 12.25px;
    }
  `;

  const renderIcon = () => (
    <span className="fa-layers fa-3x fa-fw widget-icon">
      <FontAwesomeIcon icon={faCircle} color={backgroundColor} />
      <FontAwesomeIcon
        icon={icon}
        inverse
        transform="shrink-6"
        color={colors.white}
      />
    </span>
  );

  const renderFooterBasedOnChange = (currentYearTotal, lastYearTotal) => {
    const icon =
      (currentYearTotal > lastYearTotal && faCaretUp) ||
      (currentYearTotal < lastYearTotal && faCaretDown) ||
      null;
    const text =
      (currentYearTotal > lastYearTotal && "Up from") ||
      (currentYearTotal < lastYearTotal && "Down from") ||
      "Same as";

    return (
      <Row className="card-bottom">
        <Col
          xs="3"
          md="3"
          lg="4"
          xl="3"
          className="text-left widget-change-icon"
        >
          {!!icon ? (
            <FontAwesomeIcon size="2x" icon={icon} color={colors.dark} />
          ) : (
            "--"
          )}
        </Col>
        {!!lastYearTotal && (
          <Col
            xs="9"
            md="9"
            lg="8"
            xl="9"
            className="text-muted text-wrap pl-0 pt-1"
          >
            {`${text} ${lastYearTotal.toLocaleString()} this time last year`}
          </Col>
        )}
      </Row>
    );
  };

  return (
    <StyledWidget>
      <Card>
        <CardBody className="pb-2">
          <Row>
            <Col>
              {/* Show spinner while waiting for data, add thousands separator to total */}
              <h1 className="total">
                {!!totalsObject ? (
                  totalsObject[currentYear].toLocaleString()
                ) : (
                  <ColorSpinner color={backgroundColor} />
                )}
              </h1>
            </Col>
          </Row>
          <Row>
            <Col xs="3" md="3" lg="4" xl="3" className="text-left">
              {renderIcon()}
            </Col>
            <Col xs="9" md="9" lg="8" xl="9">
              <Row>
                <h5 className="mb-0">{text}</h5>
              </Row>
              <Row>
                <h5 className="text-muted">{`in ${currentYearString}`}</h5>
              </Row>
            </Col>
          </Row>
        </CardBody>
        {!!totalsObject && (
          <CardFooter className="widget-footer">
            {renderFooterBasedOnChange(
              totalsObject[currentYear],
              totalsObject[prevYear]
            )}
          </CardFooter>
        )}
      </Card>
    </StyledWidget>
  );
};

export default SummaryWidget;
