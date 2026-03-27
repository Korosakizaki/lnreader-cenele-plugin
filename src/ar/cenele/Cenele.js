// Final JS version for LNReader v2 with advanced de-obfuscation and encoding handling
const fetchApi = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error('Network response was not ok');
  return response;
};

const fetchHtml = async (url) => {
  const response = await fetchApi(url);
  // Force UTF-8 decoding to fix the "scribbles" (UTF-8 misinterpreted as Latin-1)
  const buffer = await response.arrayBuffer();
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(buffer);
};

const defaultCover = 'https://via.placeholder.com/150';

class CenelePlugin {
  constructor() {
    this.id = 'cenele';
    this.name = 'Cenele';
    this.site = 'https://cenele.com/';
    this.version = '1.0.2';
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
    const coverMatch = body.match(/<img[^>]*class="[^"]*img-responsive[^"]*".*?src="([^"]+)"/);
    
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
    
    const contentMatch = body.match(/<div class="reading-content[^"]*">([\s\S]*?)<\/div>/);
    if (!contentMatch) return 'Content not found';
    
    let content = contentMatch[1];
    
    // 1. Remove elements that are hidden or contain "stolen" messages
    // This includes spans with display:none and specific anti-scraping text
    content = content.replace(/<span[^>]*style="[^"]*display:\s*none[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');
    content = content.replace(/<div[^>]*style="[^"]*display:\s*none[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    
    // 2. Remove specific "stolen" phrases and tracking codes (e.g., #7eBjc5Xdd1)
    content = content.replace(/هذا الفصل مسروق من موقع فضاء الروايات/g, '');
    content = content.replace(/فصول مسروقة من موقع فضاء الروايات/g, '');
    content = content.replace(/cenele\.com/gi, '');
    content = content.replace(/https?:\/\/cenele\.com\//gi, '');
    content = content.replace(/#[a-zA-Z0-9]{10}/g, ''); // Matches tracking codes like #7eBjc5Xdd1
    
    // 3. Clean up the remaining HTML tags but keep basic formatting
    content = content.replace(/<(?!p|br|b|i|strong|em)[^>]+>/gi, '');
    
    // 4. Final trim and cleanup of multiple line breaks
    content = content.replace(/(\s*<br\s*\/?>\s*){3,}/gi, '<br><br>');
    
    return content.trim();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = new CenelePlugin();
}
