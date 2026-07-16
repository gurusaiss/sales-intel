export interface NewsSource {
  name: string;
  url: string;
  rssUrl: string;
  category: string;
  pollIntervalMin: number;
}

export const NEWS_SOURCES: NewsSource[] = [
  { name: "OpenAI Blog", url: "https://openai.com/news", rssUrl: "https://openai.com/news/rss.xml", category: "AI", pollIntervalMin: 30 },
  { name: "Google DeepMind", url: "https://deepmind.google/blog", rssUrl: "https://deepmind.google/blog/rss.xml", category: "AI", pollIntervalMin: 30 },
  { name: "Google AI Blog", url: "https://ai.googleblog.com", rssUrl: "https://feeds.feedburner.com/blogspot/gJZg", category: "AI", pollIntervalMin: 30 },
  { name: "Simon Willison", url: "https://simonwillison.net", rssUrl: "https://simonwillison.net/atom/everything/", category: "AI", pollIntervalMin: 60 },
  { name: "Hugging Face Blog", url: "https://huggingface.co/blog", rssUrl: "https://huggingface.co/blog/feed.xml", category: "AI", pollIntervalMin: 30 },
  { name: "TechCrunch", url: "https://techcrunch.com", rssUrl: "https://techcrunch.com/feed/", category: "Tech", pollIntervalMin: 15 },
  { name: "The Verge", url: "https://www.theverge.com", rssUrl: "https://www.theverge.com/rss/index.xml", category: "Tech", pollIntervalMin: 15 },
  { name: "Wired", url: "https://www.wired.com", rssUrl: "https://www.wired.com/feed/rss", category: "Tech", pollIntervalMin: 30 },
  { name: "Ars Technica", url: "https://arstechnica.com", rssUrl: "https://feeds.arstechnica.com/arstechnica/index", category: "Tech", pollIntervalMin: 30 },
  { name: "VentureBeat", url: "https://venturebeat.com", rssUrl: "https://venturebeat.com/feed/", category: "Startups", pollIntervalMin: 20 },
  { name: "MIT Technology Review", url: "https://www.technologyreview.com", rssUrl: "https://www.technologyreview.com/feed/", category: "Tech", pollIntervalMin: 30 },
  { name: "The New Stack", url: "https://thenewstack.io", rssUrl: "https://thenewstack.io/feed", category: "DevOps", pollIntervalMin: 30 },
  { name: "Cloudflare Blog", url: "https://blog.cloudflare.com", rssUrl: "https://blog.cloudflare.com/rss/", category: "Cloud", pollIntervalMin: 30 },
  { name: "AWS News Blog", url: "https://aws.amazon.com/blogs/aws/", rssUrl: "https://aws.amazon.com/blogs/aws/feed/", category: "Cloud", pollIntervalMin: 30 },
  { name: "Dev.to", url: "https://dev.to", rssUrl: "https://dev.to/feed", category: "Web Dev", pollIntervalMin: 20 },
  { name: "InfoQ", url: "https://www.infoq.com", rssUrl: "https://feed.infoq.com/", category: "Engineering", pollIntervalMin: 30 },
  { name: "GitHub Blog", url: "https://github.blog", rssUrl: "https://github.blog/feed/", category: "Open Source", pollIntervalMin: 30 },
  { name: "Hacker News", url: "https://news.ycombinator.com", rssUrl: "https://hnrss.org/frontpage", category: "Startups", pollIntervalMin: 15 },
  { name: "TLDR Newsletter", url: "https://tldr.tech", rssUrl: "https://tldr.tech/rss", category: "Tech", pollIntervalMin: 30 },
  { name: "Product Hunt Daily", url: "https://www.producthunt.com", rssUrl: "https://www.producthunt.com/feed", category: "Startups", pollIntervalMin: 60 },
  { name: "Krebs on Security", url: "https://krebsonsecurity.com", rssUrl: "https://krebsonsecurity.com/feed/", category: "Cybersecurity", pollIntervalMin: 30 },
  { name: "The Hacker News", url: "https://thehackernews.com", rssUrl: "https://feeds.feedburner.com/TheHackersNews", category: "Cybersecurity", pollIntervalMin: 30 },
  { name: "Schneier on Security", url: "https://www.schneier.com", rssUrl: "https://www.schneier.com/feed/atom", category: "Cybersecurity", pollIntervalMin: 60 },
  { name: "Towards Data Science", url: "https://towardsdatascience.com", rssUrl: "https://medium.com/feed/towards-data-science", category: "Data Science", pollIntervalMin: 30 },
  { name: "KDnuggets", url: "https://www.kdnuggets.com", rssUrl: "https://www.kdnuggets.com/feed", category: "Data Science", pollIntervalMin: 30 },
];

export const NEWS_CATEGORIES = [...new Set(NEWS_SOURCES.map((s) => s.category))].sort();
