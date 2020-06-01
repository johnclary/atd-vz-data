import React from "react";

import { Container, Row, Col } from "reactstrap";
import styled from "styled-components";
import { colors } from "../../constants/colors";
import { responsive } from "../../constants/responsive";
import logo from "./coa_seal_transparent_white.png";

let pckg = require("../../../package.json");

const Footer = () => {
  const StyledFooter = styled.div`
    color: ${colors.light};
    font-weight: bold;

    .link-table {
      background: ${colors.dark};
      position: absolute;
      left: 0px;
      padding: 45px 40px 45px 25%;
      color: ${colors.light};
      font-size: 16px;
    }

    .link-title {
      font-size: 20px;
      padding: 10px 15px 10px 15px;
    }

    .link {
      padding: 10px 15px 10px 15px;
    }

    .coa-seal {
      z-index: 2;
      position: relative;
      left: 100px;
      top: 45px;
    }

    .version {
      font-weight: normal;
      font-size: 14px;
    }

    a,
    a:hover {
      color: ${colors.light};
    }

    /* Prevent links from overlapping CoA seal */
    @media only screen and (max-width: ${responsive.bootstrapLarge}px) {
      .coa-seal {
        position: relative;
        left: 40px;
        top: 45px;
      }
    }

    /* Center CoA seal and links on mobile */
    @media only screen and (max-width: ${responsive.bootstrapMedium}px) {
      text-align: center;

      .link-table {
        padding: 80px 0px 0px 0px;
        margin: 0px auto;
      }

      .coa-seal {
        position: relative;
        background: ${colors.dark};
        top: -20px;
        border: 10px solid ${colors.dark};
        border-radius: 50%;
        left: 50%;
        transform: translate(-50%, 0%);
      }
    }
  `;

  const footerLinks = [
    {
      text: "Data",
      url:
        "https://data.austintexas.gov/Transportation-and-Mobility/-UNDER-CONSTRUCTION-Crash-Report-Data/y2wy-tgr5/data",
    },
    {
      text: "Code",
      url: "https://github.com/cityofaustin/atd-vz-data/tree/master/atd-vzv",
    },
    {
      text: "Disclaimer",
      url: "https://austintexas.gov/page/city-austin-open-data-terms-use",
    },
    { text: "Privacy", url: "https://www.austintexas.gov/page/privacy-policy" },
    {
      text: "Give feedback on Vision Zero Viewer",
      url: "mailto:transportation.data@austintexas.gov",
    },
    { text: "Powered by Data & Technology Services" },
    { text: <div className="version">v{pckg.version}</div> },
  ];

  return (
    <StyledFooter>
      <Container fluid className="mt-5">
        <img className="coa-seal float-left" height="100px" src={logo} />
        <Row className="link-table">
          <Col xs="12" className="link-title">
            City of Austin Transportation Department
          </Col>
          {footerLinks.map((link) => (
            <Col xs="12" md="6" className="link">
              {link.url ? <a href={link.url}>{link.text}</a> : link.text}
            </Col>
          ))}
        </Row>
      </Container>
    </StyledFooter>
  );
};

export default Footer;
