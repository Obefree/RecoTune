import re

from bs4 import BeautifulSoup

from .tab import UltimateTab, UltimateTabInfo


def _tab_info_from_soup(soup: BeautifulSoup) -> UltimateTabInfo:
    try:
        song_title = soup.find(attrs={'itemprop': 'name'}).text
        song_title = re.compile(re.escape('chords'), re.IGNORECASE).sub(r'', song_title).strip()
    except Exception:
        song_title = 'UNKNOWN'

    try:
        artist_name = soup.find(attrs={'class': 't_autor'}).text.replace('\n', '')
        artist_name = re.compile(re.escape('by'), re.IGNORECASE).sub(r'', artist_name).strip()
    except Exception:
        artist_name = 'UNKNOWN'

    author = 'UNKNOWN'
    difficulty = None
    key = None
    capo = None
    tuning = None
    try:
        info_header_text = soup.find(attrs={'class': 't_dt'}).text.replace('\n', '')
        info_headers = [x.lower() for x in info_header_text.split(' ') if x]
        info_header_values = soup.findAll(attrs={'class': 't_dtde'})

        for index, header in enumerate(info_headers):
            try:
                if header == 'author':
                    author = info_header_values[index].a.text
                elif header == 'difficulty':
                    difficulty = info_header_values[index].text.strip()
                elif header == 'key':
                    key = info_header_values[index].text.strip()
                elif header == 'capo':
                    capo = info_header_values[index].text.strip()
                elif header == 'tuning':
                    tuning = info_header_values[index].text.strip()
            except Exception:
                continue
    except Exception:
        pass

    return UltimateTabInfo(song_title, artist_name, author, difficulty, key, capo, tuning)


def html_tab_to_json_dict(html_body: str, pre_class_tags: list) -> dict:
    soup = BeautifulSoup(html_body, 'html.parser')
    tab_info = _tab_info_from_soup(soup)
    tabs_html_content = soup.find('pre', attrs={'class': pre_class_tags})
    if tabs_html_content is None:
        raise ValueError('legacy pre tab block not found')

    formatted_tab_string = ''.join(map(str, tabs_html_content.contents))
    tab = UltimateTab()
    re_span_tag = re.compile(r']*>|<\/span[^>]*>')

    for tab_line in formatted_tab_string.split('\n'):
        if not tab_line:
            tab.append_blank_line()
        elif re_span_tag.search(tab_line):
            sanitized_tab_line = re_span_tag.sub(r' ', tab_line)
            tab.append_chord_line(sanitized_tab_line)
        else:
            tab.append_lyric_line(tab_line)

    payload = {
        'title': tab_info.title,
        'artist_name': tab_info.artist,
        'author': tab_info.author,
    }
    if tab_info.difficulty is not None:
        payload['difficulty'] = tab_info.difficulty
    if tab_info.key is not None:
        payload['key'] = tab_info.key
    if tab_info.capo is not None:
        payload['capo'] = tab_info.capo
    if tab_info.tuning is not None:
        payload['tuning'] = tab_info.tuning
    payload['lines'] = tab.as_json_dictionary()['lines']
    return {'tab': payload}
