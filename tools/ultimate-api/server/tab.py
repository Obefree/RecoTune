from typing import Any


class UltimateTabInfo(object):
    def __init__(
        self,
        title: str,
        artist: str,
        author: str,
        difficulty: str = None,
        key: str = None,
        capo: str = None,
        tuning: str = None,
    ):
        self.title = title
        self.artist = artist
        self.author = author
        self.difficulty = difficulty
        self.key = key
        self.capo = capo
        self.tuning = tuning


class UltimateTab(object):
    JSON_CONTAINER_NAME = 'lines'
    JSON_KEY_CHORD_ARRAY = 'chords'
    JSON_KEY_NOTE = 'note'
    JSON_KEY_LYRIC = 'lyric'
    JSON_KEY_BLANK = 'blank'
    JOSN_KEY_LEAD_SPACES = 'pre_spaces'

    def __init__(self):
        self.lines = []

    def _append_new_line(self, type: str, content_tag: str, content: Any) -> None:
        line = {'type': type}
        if content_tag is not None:
            line[content_tag] = content
        self.lines.append(line)

    def append_chord_line(self, chords_line: str) -> None:
        chords = []
        leading_spaces = 0
        for c in chords_line.split(' '):
            if not c:
                leading_spaces += 1
            else:
                chord = {
                    self.JSON_KEY_NOTE: c,
                    self.JOSN_KEY_LEAD_SPACES: leading_spaces,
                }
                chords.append(chord)
                leading_spaces = 1
        self._append_new_line(self.JSON_KEY_CHORD_ARRAY, self.JSON_KEY_CHORD_ARRAY, chords)

    def append_lyric_line(self, lyric_line: str) -> None:
        self._append_new_line(self.JSON_KEY_LYRIC, self.JSON_KEY_LYRIC, lyric_line)

    def append_blank_line(self) -> None:
        self._append_new_line(self.JSON_KEY_BLANK, None, None)

    def as_json_dictionary(self) -> dict:
        return {self.JSON_CONTAINER_NAME: self.lines}
