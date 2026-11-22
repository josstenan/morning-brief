/**
 * Morning Brief page, built on Soft UI Dashboard React by Creative Tim (MIT License).
 */
import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";

import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import ButtonBase from "@mui/material/ButtonBase";
import Dialog from "@mui/material/Dialog";
import useMediaQuery from "@mui/material/useMediaQuery";

import SoftBox from "components/SoftBox";
import SoftTypography from "components/SoftTypography";
import SoftButton from "components/SoftButton";
import SoftInput from "components/SoftInput";
import SoftBadge from "components/SoftBadge";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import MiniStatisticsCard from "examples/Cards/StatisticsCards/MiniStatisticsCard";

import { useSoftUIController, setMiniSidenav } from "context";

const SECTIONS = [
  { key: "acct", title: "Global accounting and reporting", icon: "fact_check", color: "info" },
  { key: "fin", title: "Global finance and markets", icon: "trending_up", color: "success" },
  { key: "tax", title: "Global tax", icon: "account_balance", color: "warning" },
  { key: "id", title: "Indonesia", icon: "flag", color: "error" },
];
const CHIPS = [
  ["all", "All"], ["acct", "Accounting"], ["fin", "Finance"], ["tax", "Tax"], ["id", "Indonesia"],
  ["p2", "Pillar Two"], ["tp", "Transfer pricing"], ["disputes", "Tax disputes"], ["audit", "Audit"],
];
const GROUP_ICON = { "Interest rates": "percent", Rupiah: "currency_exchange", "Stock markets": "show_chart", Crypto: "currency_bitcoin" };

function safeUrl(u) {
  return /^https?:\/\//.test(u || "") ? u : undefined;
}
function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem("mb-saved") || "{}");
  } catch (e) {
    return {};
  }
}

function BriefPage({ savedOnly }) {
  const [controller, dispatch] = useSoftUIController();
  const { miniSidenav } = controller;
  const [briefs, setBriefs] = useState([]);
  const [error, setError] = useState(false);
  const [day, setDay] = useState(null);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [saved, setSaved] = useState(loadSaved);
  const [open, setOpen] = useState(null);
  const phone = useMediaQuery("(max-width:600px)");
  const [hidden, setHidden] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mb-hidden-groups") || "{}");
    } catch (e) {
      return {};
    }
  });

  const [hiddenSec, setHiddenSec] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mb-hidden-sections") || "{}");
    } catch (e) {
      return {};
    }
  });
  const toggleSection = (key) => {
    const next = { ...hiddenSec, [key]: !hiddenSec[key] };
    setHiddenSec(next);
    try {
      localStorage.setItem("mb-hidden-sections", JSON.stringify(next));
    } catch (e) {
      /* storage unavailable */
    }
  };

  const toggleGroup = (name) => {
    const next = { ...hidden, [name]: !hidden[name] };
    setHidden(next);
    try {
      localStorage.setItem("mb-hidden-groups", JSON.stringify(next));
    } catch (e) {
      /* storage unavailable */
    }
  };

  useEffect(() => {
    const base = `${process.env.PUBLIC_URL}/briefs`;
    const getJson = (url) =>
      fetch(url, { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      });
    getJson(`${base}/index.json`)
      .then((index) => Promise.all((index.months || []).map((m) => getJson(`${base}/${m}.json`))))
      .then((months) => {
        const all = [];
        months.forEach((m) => (m.briefs || []).forEach((b) => all.push(b)));
        const list = all.sort((a, b) => (a.date < b.date ? 1 : -1));
        setBriefs(list);
        setDay(list.length ? list[0].date : null);
      })
      .catch(() => setError(true));
  }, []);

  const toggleSave = (id) => {
    const next = { ...saved };
    if (next[id]) delete next[id];
    else next[id] = true;
    setSaved(next);
    try {
      localStorage.setItem("mb-saved", JSON.stringify(next));
    } catch (e) {
      /* storage unavailable */
    }
  };

  const brief = briefs.find((b) => b.date === day) || briefs[0];

  const rows = useMemo(() => {
    const query = q.toLowerCase().trim();
    const pool = [];
    (query || savedOnly ? briefs : brief ? [brief] : []).forEach((b) =>
      b.items.forEach((it) => pool.push({ it, brief: b }))
    );
    return pool.filter(({ it }) => {
      const okF = filter === "all" || it.section === filter || (it.topics || []).includes(filter);
      const text = `${it.title} ${it.summary} ${(it.tags || []).join(" ")} ${it.source}`.toLowerCase();
      const okQ = !query || text.includes(query);
      const okS = !savedOnly || !!saved[it.id];
      return okF && okQ && okS;
    });
  }, [briefs, brief, filter, q, saved, savedOnly]);

  const groups = useMemo(() => {
    const out = [];
    (brief ? brief.markets : []).forEach((m) => {
      let g = out.find((x) => x.name === m.group);
      if (!g) {
        g = { name: m.group, list: [] };
        out.push(g);
      }
      g.list.push(m);
    });
    return out;
  }, [brief]);

  return (
    <DashboardLayout>
      {/* Header */}
      <SoftBox py={2} display="flex" flexWrap="wrap" alignItems="flex-end" justifyContent="space-between" gap={2}>
        <SoftBox display="flex" alignItems="center" gap={1}>
          <IconButton
            size="small"
            aria-label="Open menu"
            onClick={() => setMiniSidenav(dispatch, !miniSidenav)}
            sx={{ display: { xs: "inline-flex", xl: "none" } }}
          >
            <Icon>menu</Icon>
          </IconButton>
          <SoftBox>
            <SoftTypography variant="button" color="info" fontWeight="bold" textTransform="uppercase">
              Accounting, Finance &amp; Tax
            </SoftTypography>
            <SoftTypography variant="h3" fontWeight="bold">
              {savedOnly ? "Saved items" : "Morning Brief"}
            </SoftTypography>
            <SoftTypography variant="body2" color="text">
              {error
                ? "Could not load the briefs. Check your connection and refresh."
                : brief
                ? `${brief.label} · ${briefs.length} ${briefs.length === 1 ? "brief" : "briefs"} saved`
                : "Loading…"}
            </SoftTypography>
          </SoftBox>
        </SoftBox>
        <SoftBox display="flex" flexWrap="wrap" gap={1} alignItems="center">
          <SoftBox width="16rem" maxWidth="100%">
            <SoftInput
              placeholder="Search all briefs"
              icon={{ component: "search", direction: "left" }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              inputProps={{ "aria-label": "Search all briefs" }}
            />
          </SoftBox>
          {!savedOnly && briefs.length > 0 && (
            <SoftBox
              component="select"
              aria-label="Choose a day"
              value={day || ""}
              onChange={(e) => setDay(e.target.value)}
              sx={{ height: "2.5rem", borderRadius: "0.5rem", border: "1px solid #d2d6da", px: 1.5, fontSize: "0.875rem", background: "#fff", color: "#344767" }}
            >
              {briefs.map((b) => (
                <option key={b.date} value={b.date}>
                  {b.label}
                </option>
              ))}
            </SoftBox>
          )}
        </SoftBox>
      </SoftBox>

      {/* Market strip */}
      {!savedOnly &&
        groups.map((g) => (
          <SoftBox key={g.name} mb={hidden[g.name] ? 1.5 : 3}>
            <SoftBox display="flex" alignItems="center" justifyContent="space-between" gap={1}>
              <SoftTypography variant="caption" color="secondary" fontWeight="bold" textTransform="uppercase">
                {g.name}
              </SoftTypography>
              <SoftButton
                variant="text"
                color="info"
                size="small"
                aria-expanded={!hidden[g.name]}
                aria-controls={`group-${g.name.replace(/\s+/g, "-")}`}
                onClick={() => toggleGroup(g.name)}
                sx={{ minHeight: "2.75rem", px: 1 }}
              >
                {hidden[g.name] ? "Show" : "Hide"}
                <Icon sx={{ ml: 0.5 }}>{hidden[g.name] ? "expand_more" : "expand_less"}</Icon>
              </SoftButton>
            </SoftBox>
            {!hidden[g.name] && (
            <Grid container spacing={2} mt={0} id={`group-${g.name.replace(/\s+/g, "-")}`}>
              {g.list.map((m) => (
                <Grid item xs={12} sm={6} xl={3} key={m.label}>
                  <SoftBox title={`Source: ${m.source}`}>
                    <MiniStatisticsCard
                      title={{ text: m.label, fontWeight: "medium" }}
                      count={m.value}
                      percentage={{ color: m.dir === "down" ? "error" : m.dir === "up" ? "success" : "secondary", text: m.delta }}
                      icon={{ color: "info", component: GROUP_ICON[g.name] || "insights" }}
                    />
                  </SoftBox>
                </Grid>
              ))}
            </Grid>
            )}
          </SoftBox>
        ))}

      {/* Filters */}
      <SoftBox display="flex" flexWrap="wrap" gap={1} alignItems="center" mb={3}>
        {CHIPS.map(([key, label]) => (
          <SoftButton
            key={key}
            size="small"
            variant={filter === key ? "gradient" : "outlined"}
            color="dark"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label}
          </SoftButton>
        ))}
        <SoftTypography variant="body2" color="text" ml="auto">
          {rows.length} {rows.length === 1 ? "item" : "items"}
        </SoftTypography>
      </SoftBox>

      <Grid container spacing={3}>
        {/* Items */}
        <Grid item xs={12} lg={8}>
          {rows.length === 0 && briefs.length > 0 && (
            <Card>
              <SoftBox p={3} textAlign="center">
                <SoftTypography variant="body2" color="text">
                  {savedOnly ? "Star items on the Today page and they appear here." : "Nothing matches. Try another filter or clear the search."}
                </SoftTypography>
              </SoftBox>
            </Card>
          )}
          {SECTIONS.map((sec) => {
            const list = rows.filter((r) => r.it.section === sec.key);
            if (!list.length) return null;
            return (
              <SoftBox mb={3} key={sec.key}>
                <Card>
                  <SoftBox p={2} display="flex" alignItems="center" gap={1.5}>
                    <SoftBox
                      variant="gradient"
                      bgColor={sec.color}
                      color="white"
                      width="2.25rem"
                      height="2.25rem"
                      borderRadius="md"
                      display="flex"
                      justifyContent="center"
                      alignItems="center"
                      shadow="md"
                    >
                      <Icon fontSize="small">{sec.icon}</Icon>
                    </SoftBox>
                    <SoftTypography variant="h6" fontWeight="bold">
                      {sec.title}
                    </SoftTypography>
                    <SoftTypography variant="caption" color="text">
                      {list.length} {list.length === 1 ? "item" : "items"}
                    </SoftTypography>
                    <SoftButton
                      variant="text"
                      color="info"
                      size="small"
                      aria-expanded={!hiddenSec[sec.key]}
                      aria-controls={`sec-${sec.key}`}
                      onClick={() => toggleSection(sec.key)}
                      sx={{ ml: "auto", minHeight: "2.75rem", px: 1, flexShrink: 0 }}
                    >
                      {hiddenSec[sec.key] ? "Show" : "Hide"}
                      <Icon sx={{ ml: 0.5 }}>{hiddenSec[sec.key] ? "expand_more" : "expand_less"}</Icon>
                    </SoftButton>
                  </SoftBox>
                  {!hiddenSec[sec.key] && (
                  <SoftBox px={2} pb={1} id={`sec-${sec.key}`}>
                    {list.map(({ it, brief: b }) => (
                      <SoftBox key={it.id} py={1.5} display="flex" gap={1.5} borderTop="1px solid #e9ecef">
                        <ButtonBase
                          onClick={() => setOpen({ it, brief: b })}
                          aria-label={`Open: ${it.title}`}
                          sx={{ flex: 1, minWidth: 0, display: "block", textAlign: "left", borderRadius: "0.5rem", "&:hover h6, &:hover .mb-title": { color: "#17c1e8" } }}
                        >
                          <SoftTypography className="mb-title" variant="body2" fontWeight="bold" color="dark" display="block" lineHeight={1.4}>
                            {it.title}
                          </SoftTypography>
                          <SoftTypography variant="body2" color="text" display="block" lineHeight={1.6} mt={0.5}>
                            {it.summary}
                          </SoftTypography>
                          <SoftBox display="flex" flexWrap="wrap" gap={0.75} alignItems="center" mt={1}>
                            <SoftTypography variant="caption" color="info" fontWeight="bold" textTransform="none">
                              {it.source}
                            </SoftTypography>
                            {b !== brief && <SoftBadge badgeContent={b.date} color="dark" variant="contained" size="xs" container />}
                            {(it.tags || []).map((t) => (
                              <SoftBadge key={t} badgeContent={t} color="secondary" variant="contained" size="xs" container />
                            ))}
                          </SoftBox>
                        </ButtonBase>
                        <IconButton
                          aria-label={saved[it.id] ? "Remove from saved" : "Save this item"}
                          aria-pressed={!!saved[it.id]}
                          onClick={() => toggleSave(it.id)}
                          sx={{ alignSelf: "flex-start", color: saved[it.id] ? "#f59e0b" : "#8392ab" }}
                        >
                          <Icon>{saved[it.id] ? "star" : "star_border"}</Icon>
                        </IconButton>
                      </SoftBox>
                    ))}
                  </SoftBox>
                  )}
                </Card>
              </SoftBox>
            );
          })}
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} lg={4}>
          {brief && brief.worth && (
            <SoftBox mb={3}>
              <Card>
                <SoftBox p={3} variant="gradient" bgColor="dark" borderRadius="xl">
                  <SoftTypography variant="caption" color="white" opacity={0.7} fontWeight="bold" textTransform="uppercase">
                    Worth reading
                  </SoftTypography>
                  <SoftTypography variant="h5" color="white" fontWeight="bold" mt={0.5}>
                    {brief.worth.title}
                  </SoftTypography>
                  <SoftTypography variant="body2" color="white" opacity={0.85} display="block" my={1.5} lineHeight={1.6}>
                    {brief.worth.text}
                  </SoftTypography>
                  <SoftButton
                    variant="gradient"
                    color="info"
                    size="small"
                    onClick={() => {
                      const match = brief.items.find((x) => x.url === brief.worth.url);
                      if (match) setOpen({ it: match, brief });
                    }}
                  >
                    Read more
                  </SoftButton>
                </SoftBox>
              </Card>
            </SoftBox>
          )}
          {brief && brief.notFound && (
            <SoftBox mb={3}>
              <Card>
                <SoftBox p={3}>
                  <SoftTypography variant="h6" fontWeight="bold">
                    Not found today
                  </SoftTypography>
                  <SoftTypography variant="body2" color="text" display="block" mt={1} lineHeight={1.6}>
                    {brief.notFound}
                  </SoftTypography>
                </SoftBox>
              </Card>
            </SoftBox>
          )}
          <Card>
            <SoftBox p={3}>
              <SoftTypography variant="h6" fontWeight="bold">
                About
              </SoftTypography>
              <SoftTypography variant="body2" color="text" display="block" mt={1} lineHeight={1.6}>
                Updated every morning at 5:00am Melbourne time. Every item links to its source. Built on Soft UI Dashboard React by Creative Tim (MIT License).
              </SoftTypography>
            </SoftBox>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={!!open} onClose={() => setOpen(null)} fullScreen={phone} maxWidth="sm" fullWidth scroll="paper" aria-labelledby="item-title">
        {open && (
          <SoftBox p={3} pt={phone ? 2 : 3}>
            <SoftBox display="flex" alignItems="center" justifyContent="space-between" gap={1} mb={1}>
              <SoftTypography variant="caption" color="info" fontWeight="bold" textTransform="uppercase">
                {(SECTIONS.find((x) => x.key === open.it.section) || {}).title} · {open.brief.label}
              </SoftTypography>
              <IconButton aria-label="Close" onClick={() => setOpen(null)}>
                <Icon>close</Icon>
              </IconButton>
            </SoftBox>
            <SoftTypography id="item-title" variant="h4" fontWeight="bold" lineHeight={1.3}>
              {open.it.title}
            </SoftTypography>
            <SoftTypography variant="body1" color="text" mt={2} lineHeight={1.7}>
              {open.it.summary}
            </SoftTypography>
            {(open.it.detail || []).map((para) => (
              <SoftTypography key={para.slice(0, 40)} variant="body1" color="text" mt={2} lineHeight={1.7}>
                {para}
              </SoftTypography>
            ))}
            {open.it.why && (
              <SoftBox mt={3} p={2} borderRadius="lg" sx={{ background: "#f0f7fb" }}>
                <SoftTypography variant="caption" color="info" fontWeight="bold" textTransform="uppercase">
                  Why it matters
                </SoftTypography>
                <SoftTypography variant="body2" color="dark" mt={0.5} lineHeight={1.7}>
                  {open.it.why}
                </SoftTypography>
              </SoftBox>
            )}
            <SoftBox display="flex" flexWrap="wrap" gap={0.75} mt={3}>
              {(open.it.tags || []).map((t) => (
                <SoftBadge key={t} badgeContent={t} color="secondary" variant="contained" size="xs" container />
              ))}
            </SoftBox>
            <SoftBox display="flex" flexWrap="wrap" gap={1} alignItems="center" mt={3} pt={2} borderTop="1px solid #e9ecef">
              <SoftButton variant={saved[open.it.id] ? "gradient" : "outlined"} color="warning" size="small" onClick={() => toggleSave(open.it.id)}>
                <Icon sx={{ mr: 0.5 }}>{saved[open.it.id] ? "star" : "star_border"}</Icon>
                {saved[open.it.id] ? "Saved" : "Save"}
              </SoftButton>
              <SoftTypography variant="caption" color="text" ml="auto">
                Source: {open.it.source}
              </SoftTypography>
              {safeUrl(open.it.url) && (
                <SoftButton component="a" href={safeUrl(open.it.url)} target="_blank" rel="noopener" variant="text" color="info" size="small">
                  Original article
                  <Icon sx={{ ml: 0.5 }}>open_in_new</Icon>
                </SoftButton>
              )}
            </SoftBox>
          </SoftBox>
        )}
      </Dialog>
    </DashboardLayout>
  );
}

BriefPage.defaultProps = { savedOnly: false };
BriefPage.propTypes = { savedOnly: PropTypes.bool };

export default BriefPage;
