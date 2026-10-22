# School navigation

The School sidebar contains credit overview, separator, schedule, tasks, separator, and semester/course navigation. Graduation requirements remain available from credit overview and via the unchanged direct requirements URL, which highlights credit overview in the sidebar.

Semester groups use native keyboard-accessible details/summary. Course buttons preserve the existing selection URL, save-before-navigation and revision paths through the School controller. Selection opens its semester automatically; group expansion lasts for the current account session and never stores course content in browser storage. Account changes reset expansion state. Successful existing School loads and edits repaint the list without an additional API request or new document listeners.

Mobile has the same four navigation destinations. Opening the active semester destination reveals/hides the grouped sidebar; selecting a course returns to its page. Back retains the existing mobile list/history behavior. The obsolete personal-workspace footer text is removed throughout navigation.

Isolated Chromium checks cover 1440/390/320 widths, grouped courses, navigation, Back/reload, active state, unchanged requirement URL, own-account fixtures and overflow. No live course content is changed.
