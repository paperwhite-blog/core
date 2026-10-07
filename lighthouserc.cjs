// Lighthouse CI: mobile (default emulation), all four categories ≥ 95 for the default theme.
module.exports = {
  ci: {
    collect: {
      staticDistDir: './examples/site/dist',
      url: [
        'http://localhost/',
        'http://localhost/embeds/',
        'http://localhost/hello-world/',
        'http://localhost/fa/%D8%B3%D9%84%D8%A7%D9%85-%D8%AF%D9%86%DB%8C%D8%A7/',
        'http://localhost/old-wordpress-post/',
      ],
      numberOfRuns: 3, // CI runners are noisy; assertions use the median
      settings: { chromeFlags: '--headless=new --no-sandbox' },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.95 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
      },
    },
    upload: { target: 'filesystem', outputDir: './.lighthouseci/reports' },
  },
};
