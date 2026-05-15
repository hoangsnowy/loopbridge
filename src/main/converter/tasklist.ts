import type { CheerioAPI } from 'cheerio';

export function transformTaskLists($: CheerioAPI): void {
  $('ac\\:task-list').each((_, el) => {
    const $list = $(el);
    const items: string[] = [];
    $list.find('ac\\:task').each((_i, task) => {
      const $task = $(task);
      const status = $task.find('ac\\:task-status').first().text().trim();
      const body = $task.find('ac\\:task-body').first().html()?.trim() ?? '';
      const checked = status === 'complete' ? ' checked' : '';
      items.push(`<li><input type="checkbox" disabled${checked} /> ${body}</li>`);
    });
    $list.replaceWith(`<ul>${items.join('')}</ul>`);
  });
}
