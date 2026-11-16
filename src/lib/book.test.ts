import { describe, it, expect } from "vitest";
import { parseBookUrl, toIsbn13, isValidIsbn10, isValidIsbn13 } from "./book";

describe("isbn", () => {
  it("validates and converts", () => {
    expect(isValidIsbn13("978-0-7352-1129-2")).toBe(true);
    expect(isValidIsbn13("9780735211293")).toBe(false);
    expect(isValidIsbn10("0735211299")).toBe(true);
    expect(isValidIsbn10("0735211298")).toBe(false);
    expect(isValidIsbn10("080442957X")).toBe(true);
    expect(toIsbn13("0735211299")).toBe("9780735211292");
    expect(toIsbn13("978 0735211292")).toBe("9780735211292");
    expect(toIsbn13("B08N5WRWNW")).toBeNull();
    expect(toIsbn13(null)).toBeNull();
  });
});

describe("parseBookUrl", () => {
  it("reads the ISBN from URLs that carry one", () => {
    expect(parseBookUrl("https://www.amazon.com/dp/0735211299")).toEqual({
      provider: "amazon",
      isbn13: "9780735211292",
    });
    expect(parseBookUrl("https://www.amazon.co.uk/Atomic-Habits/dp/0735211299/ref=x")).toMatchObject({
      isbn13: "9780735211292",
    });
    expect(
      parseBookUrl("https://bookshop.org/p/books/atomic-habits-james-clear/9395936?ean=9780735211292")
    ).toMatchObject({ provider: "bookshop" });
    expect(
      parseBookUrl("https://bookshop.org/p/books/atomic-habits/9780735211292")
    ).toEqual({ provider: "bookshop", isbn13: "9780735211292" });
    expect(parseBookUrl("https://openlibrary.org/isbn/0735211299")).toEqual({
      provider: "openlibrary",
      isbn13: "9780735211292",
    });
    expect(
      parseBookUrl("https://www.simonandschuster.com/books/Anatomy-of-a-Breakthrough/Adam-Alter/9781982182977")
    ).toEqual({ provider: "simonandschuster", isbn13: "9781982182977" });
  });

  it("recognizes book pages without an ISBN", () => {
    expect(parseBookUrl("https://www.goodreads.com/book/show/123715.Slack")).toEqual({
      provider: "goodreads",
      isbn13: null,
    });
    expect(
      parseBookUrl("https://www.penguinrandomhouse.com/books/757558/the-thinking-machine-by-stephen-witt/")
    ).toMatchObject({ provider: "penguinrandomhouse", isbn13: null });
    expect(parseBookUrl("https://openlibrary.org/works/OL45804W/Fantastic_Mr_Fox")).toMatchObject({
      provider: "openlibrary",
    });
  });

  it("recognizes the big publishers' book pages", () => {
    expect(
      parseBookUrl("https://www.hachettebookgroup.com/titles/james-clear/atomic-habits/9780735211292/")
    ).toEqual({ provider: "hachette", isbn13: "9780735211292" });
    expect(parseBookUrl("https://www.harpercollins.com/products/the-hobbit-j-r-r-tolkien?variant=1")).toEqual({
      provider: "harpercollins",
      isbn13: null,
    });
    expect(parseBookUrl("https://us.macmillan.com/books/9781250178602/thesevendeaths")).toEqual({
      provider: "macmillan",
      isbn13: "9781250178602",
    });
    // Publisher pages that are not a book.
    expect(parseBookUrl("https://www.hachettebookgroup.com/")).toBeNull();
    expect(parseBookUrl("https://www.harpercollins.com/blogs/news/post")).toBeNull();
    expect(parseBookUrl("https://us.macmillan.com/authors/jane-doe")).toBeNull();
  });

  it("ignores non-book pages", () => {
    expect(parseBookUrl("https://www.goodreads.com/author/show/1")).toBeNull();
    expect(parseBookUrl("https://www.amazon.com/dp/B08N5WRWNW")).toBeNull(); // not an ISBN: any product
    expect(parseBookUrl("https://www.amazon.com/gp/cart")).toBeNull();
    expect(parseBookUrl("https://example.com/books/1")).toBeNull();
    expect(parseBookUrl("not a url")).toBeNull();
    expect(parseBookUrl(null)).toBeNull();
  });
});
