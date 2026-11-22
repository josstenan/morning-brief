/**
 * Morning Brief routes, built on Soft UI Dashboard React by Creative Tim (MIT License).
 */
import BriefPage from "layouts/brief";

import Document from "examples/Icons/Document";
import Office from "examples/Icons/Office";

const routes = [
  {
    type: "collapse",
    name: "Today",
    key: "today",
    route: "/today",
    icon: <Document size="12px" />,
    component: <BriefPage />,
    noCollapse: true,
  },
  {
    type: "collapse",
    name: "Saved",
    key: "saved",
    route: "/saved",
    icon: <Office size="12px" />,
    component: <BriefPage savedOnly />,
    noCollapse: true,
  },
];

export default routes;
