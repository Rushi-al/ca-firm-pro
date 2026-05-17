// ADD these two links to the admin sidebar in Layout.jsx
// Place them just before the "Firm Settings" link

// In adminLinks array, add:
// { to: '/pricing', label: 'Upgrade Plan', icon: <StarIcon /> }
// { to: '/billing',  label: 'Billing',      icon: <ReceiptIcon /> }

// New icons to add to the Ic object:
const BillingIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);

const StarIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

// Full updated adminLinks:
export const getAdminLinks = () => [
  { to: '/dashboard',  label: 'Dashboard',    icon: 'dash'     },
  { to: '/clients',    label: 'Clients',       icon: 'cli'      },
  { to: '/tasks',      label: 'Tasks',         icon: 'task'     },
  { to: '/employees',  label: 'Employees',     icon: 'emp'      },
  { to: '/activity',   label: 'Activity',      icon: 'act'      },
  { to: '/ai',         label: 'AI Insights',   icon: 'ai'       },
  // ── Billing section ──────────────────────────────────────
  { to: '/pricing',    label: 'Upgrade Plan',  icon: 'star',    dividerBefore: true },
  { to: '/billing',    label: 'Billing',       icon: 'billing'  },
];

// NOTE: This file shows the changes needed.
// In the full Layout.jsx from Phase 1, add these nav links
// and update the icon map with BillingIcon and StarIcon.
// The route additions go in App.jsx (see updated-app-routes.jsx)
export default { BillingIcon, StarIcon };
