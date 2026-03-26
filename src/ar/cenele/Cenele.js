// Updated JS version for LNReader v2 with content protection handling
const fetchApi = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error('Network response was not ok');
  return response;
};
const fetchHtml = async (url) => {
  const response = await fetchApi(url);
  return response.text();
};
const defaultCover = 'https://via.placeholder.com/150';

class CenelePlugin {
  constructor() {
    this.id = 'cenele';
    this.name = 'Cenele';
    this.site = 'https://cenele.com/';
    this.version = '1.0.1';
    this.icon = 'src/ar/cenele/icon.png';
    this.language = 'Arabic';
  }

  async popularNovels(pageNo) {
    const url = pageNo === 1 ? this.site : `${this.site}home/page/${pageNo}/`;
    const body = await fetchHtml(url);
    const novels = [];
    const regex = /<div class="page-item-detail[^"]*">[\s\S]*?<a href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<img[^>]*src="([^"]+)"/g;
    let match;
    while ((match = regex.exec(body)) !== null) {
      novels.push({
        name: match[2].trim(),
        path: match[1].replace(this.site, ''),
        cover: match[3] || defaultCover,
      });
    }
    return novels;
  }

  async searchNovels(searchTerm) {
    const url = `${this.site}?s=${encodeURIComponent(searchTerm)}&post_type=wp-manga`;
    const body = await fetchHtml(url);
    return this.popularNovels(1);
  }

  async parseNovel(novelPath) {
    const url = this.site + novelPath;
    const body = await fetchHtml(url);
    const nameMatch = body.match(/<h1[^>]*>([^<]+)<\/h1>/);
    const coverMatch = body.match(/<img[^>]*class="[^"]*img-responsive[^>]*"[^>]*src="([^"]+)"/);
    
    // Extract chapters
    const chapters = [];
    const chapterRegex = /<li class="wp-manga-chapter[^"]*">\s*<a href="([^"]+)">([^<]+)<\/a>/g;
    let match;
    while ((match = chapterRegex.exec(body)) !== null) {
      chapters.push({
        name: match[2].trim(),
        path: match[1].replace(this.site, ''),
        releaseTime: '',
      });
    }
    
    return {
      path: novelPath,
      name: nameMatch ? nameMatch[1].trim() : 'Unknown',
      cover: coverMatch ? coverMatch[1] : defaultCover,
      chapters: chapters.reverse(),
    };
  }

  async parseChapter(chapterPath) {
    const url = this.site + chapterPath;
    const body = await fetchHtml(url);
    
    // Extract content from the reading-content div
    const contentMatch = body.match(/<div class="reading-content[^"]*">([\s\S]*?)<\/div>/);
    if (!contentMatch) return 'Content not found';
    
    let content = contentMatch[1];
    
    // 1. Remove "stolen" messages and hidden text
    content = content.replace(/<span[^>]*style="[^"]*display:\s*none[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');
    content = content.replace(/<div[^>]*style="[^"]*display:\s*none[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    content = content.replace(/هذا الفصل مسروق من موقع فضاء الروايات/g, '');
    content = content.replace(/cenele\.com/g, '');
    
    // 2. Clean up HTML tags but keep basic formatting
    content = content.replace(/<(?!p|br|b|i|strong|em)[^>]+>/gi, '');

    return content.trim();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = new CenelePlugin();
}
