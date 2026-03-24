import { fetchApi, fetchHtml } from '@libs/fetch';
import { FilterTypes, Filters } from '@libs/filterInputs';
import { Plugin } from '@typings/plugin';
import { NovelStatus } from '@libs/novelStatus';
import { defaultCover } from '@libs/defaultCover';
import { load as parseHTML } from 'cheerio';

class CenelePlugin implements Plugin.PluginBase {
  id = 'cenele';
  name = 'Cenele';
  site = 'https://cenele.com/';
  version = '1.0.0';
  icon = 'src/ar/cenele/icon.png';
  language = 'Arabic';

  selectors = {
    novel: '.page-item-detail',
    novelTitle: '.h5 > a',
    novelCover: '.img-responsive',
    novelUrl: '.h5 > a',
    chapter: '.wp-manga-chapter',
    chapterTitle: 'a',
    chapterUrl: 'a',
    chapterDate: '.chapter-release-date',
    content: '.reading-content',
    novelStatus: '.post-status .summary-content',
    author: '.author-content',
    artist: '.artist-content',
    genre: '.genres-content a',
    summary: '.summary__content',
  };

  async popularNovels(pageNo: number, options: Plugin.PopularNovelsOptions): Promise<Plugin.NovelItem[]> {
    const url = pageNo === 1 ? this.site : `${this.site}home/page/${pageNo}/`;
    const body = await fetchHtml(url);
    const loadedCheerio = parseHTML(body);
    
    const novels: Plugin.NovelItem[] = [];

    loadedCheerio(this.selectors.novel).each((idx, ele) => {
      const novelCheerio = loadedCheerio(ele);
      const novelUrl = novelCheerio.find(this.selectors.novelUrl).attr('href');
      const novelName = novelCheerio.find(this.selectors.novelTitle).text().trim();
      const novelCover = novelCheerio.find(this.selectors.novelCover).attr('data-src') || 
                        novelCheerio.find(this.selectors.novelCover).attr('src') || 
                        defaultCover;

      if (novelUrl && novelName) {
        novels.push({
          name: novelName,
          path: novelUrl.replace(this.site, ''),
          cover: novelCover,
        });
      }
    });

    return novels;
  }

  async searchNovels(searchTerm: string, pageNo: number): Promise<Plugin.NovelItem[]> {
    const url = `${this.site}?s=${encodeURIComponent(searchTerm)}&post_type=wp-manga`;
    const body = await fetchHtml(url);
    const loadedCheerio = parseHTML(body);
    
    const novels: Plugin.NovelItem[] = [];

    loadedCheerio(this.selectors.novel).each((idx, ele) => {
      const novelCheerio = loadedCheerio(ele);
      const novelUrl = novelCheerio.find(this.selectors.novelUrl).attr('href');
      const novelName = novelCheerio.find(this.selectors.novelTitle).text().trim();
      const novelCover = novelCheerio.find(this.selectors.novelCover).attr('data-src') || 
                        novelCheerio.find(this.selectors.novelCover).attr('src') || 
                        defaultCover;

      if (novelUrl && novelName) {
        novels.push({
          name: novelName,
          path: novelUrl.replace(this.site, ''),
          cover: novelCover,
        });
      }
    });

    return novels;
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const url = this.site + novelPath;
    const body = await fetchHtml(url);
    const loadedCheerio = parseHTML(body);

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: loadedCheerio('.post-title h1').text().trim() || 'Untitled',
    };

    novel.cover = loadedCheerio('.summary_image img').attr('data-src') || 
                  loadedCheerio('.summary_image img').attr('src') || 
                  defaultCover;

    novel.summary = loadedCheerio(this.selectors.summary).text().trim();

    const author = loadedCheerio(this.selectors.author).text().trim();
    if (author) novel.author = author;

    const status = loadedCheerio(this.selectors.novelStatus).text().trim();
    if (status.includes('مكتمل') || status.includes('Complete')) {
      novel.status = NovelStatus.Completed;
    } else if (status.includes('مستمر') || status.includes('Ongoing')) {
      novel.status = NovelStatus.Ongoing;
    }

    const genres: string[] = [];
    loadedCheerio(this.selectors.genre).each((idx, ele) => {
      genres.push(loadedCheerio(ele).text().trim());
    });
    if (genres.length > 0) novel.genres = genres.join(', ');

    const chapters: Plugin.ChapterItem[] = [];
    
    const mangaId = loadedCheerio('#manga-chapters-holder').attr('data-id');
    if (mangaId) {
      const ajaxUrl = `${this.site}wp-admin/admin-ajax.php`;
      const formData = new FormData();
      formData.append('action', 'manga_get_chapters');
      formData.append('manga', mangaId);
      
      const ajaxBody = await fetchApi(ajaxUrl, {
        method: 'POST',
        body: formData,
      }).then(r => r.text());
      
      const ajaxCheerio = parseHTML(ajaxBody);
      this.parseChapters(ajaxCheerio, chapters);
    } else {
      this.parseChapters(loadedCheerio, chapters);
    }

    novel.chapters = chapters;
    return novel;
  }

  parseChapters(loadedCheerio: any, chapters: Plugin.ChapterItem[]) {
    loadedCheerio(this.selectors.chapter).each((idx, ele) => {
      const chapterCheerio = loadedCheerio(ele);
      const chapterUrl = chapterCheerio.find(this.selectors.chapterUrl).attr('href');
      const chapterName = chapterCheerio.find(this.selectors.chapterTitle).text().trim();
      const chapterDate = chapterCheerio.find(this.selectors.chapterDate).text().trim();

      if (chapterUrl && chapterName) {
        chapters.push({
          name: chapterName,
          path: chapterUrl.replace(this.site, ''),
          releaseTime: this.parseDate(chapterDate),
        });
      }
    });

    chapters.reverse();
  }

  parseDate(dateString: string): string | undefined {
    if (!dateString) return undefined;
    
    const arabicMonths: { [key: string]: string } = {
      'يناير': '01', 'فبراير': '02', 'مارس': '03', 'أبريل': '04',
      'مايو': '05', 'يونيو': '06', 'يوليو': '07', 'أغسطس': '08',
      'سبتمبر': '09', 'أكتوبر': '10', 'نوفمبر': '11', 'ديسمبر': '12'
    };

    for (const [month, num] of Object.entries(arabicMonths)) {
      if (dateString.includes(month)) {
        const parts = dateString.replace(month, num).replace(',', '').split(' ');
        if (parts.length === 3) {
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    }

    return undefined;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const url = this.site + chapterPath;
    const body = await fetchHtml(url);
    const loadedCheerio = parseHTML(body);

    loadedCheerio('.adsense-code, .ads, .ad-container, script, ins').remove();

    const content = loadedCheerio(this.selectors.content).html() || '';
    
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<ins\b[^<]*(?:(?!<\/ins>)<[^<]*)*<\/ins>/gi, '')
      .replace(/class="[^"]*"/g, '')
      .replace(/style="[^"]*"/g, '');
  }

  async fetchImage(url: string): Promise<string | undefined> {
    return fetchApi(url).then(r => r.blob()).then(b => URL.createObjectURL(b));
  }

  filters = {
    order: {
      label: 'Order by',
      value: 'latest',
      options: [
        { label: 'Latest', value: 'latest' },
        { label: 'Rating', value: 'rating' },
        { label: 'Trending', value: 'trending' },
        { label: 'Most Views', value: 'views' },
        { label: 'New', value: 'new' },
      ],
      type: FilterTypes.Picker,
    },
  } as Filters;
}

export default new CenelePlugin();
