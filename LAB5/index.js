// 패키지 불러오기
const express = require("express");
const sqlite3 = require("sqlite3");
const sqlite = require("sqlite")
const fs = require("fs/promises");
const path = require("path");


// express 인스턴스 생성
const app = express();
app.use(express.json()); // JSON parse
app.use(express.urlencoded({ extended: true })); // form parse

// static filed를 서버에 전달
app.use(express.static("public"));

// 비동기적으로 DB에 연결
async function getDBConnection() {
    const db = await sqlite.open({
        filename: path.join(__dirname, "db", "product.db"),
        driver: sqlite3.Database
    });
    return db;
};

// login.html
app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

// signup.html
app.get("/signup", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "signup.html"));
});

// index.html
app.get("/", async function (req, res) {
    const { title = "", target = "movie_rate", order = "DESC" , Id, Password} = req.query;

    const validTargets = ["movie_release_date", "movie_rate", "movie_title"];
    const validOrders = ["ASC", "DESC"];

    const safeTarget = validTargets.includes(target) ? target : "movie_release_date";
    const safeOrder = validOrders.includes(order.toUpperCase()) ? order.toUpperCase() : "DESC";

    const db = await getDBConnection();

    const query = `SELECT * FROM movies WHERE movie_title LIKE ? ORDER BY ${safeTarget} ${safeOrder}`;
    const movies = await db.all(query, [`%${title}%`]);

    await db.close();

    const orderValue = reverseSortValue(target, order)
    const indexHTML = renderIndex(movies, title, orderValue);
    res.send(indexHTML);
});

// movies.html
app.get("/movies/:movie_id", async (req, res) => {
    const movieId = Number(req.params.movie_id); 
    const db = await getDBConnection();
    const movie = await db.get("SELECT * FROM movies WHERE movie_id = ?", [movieId]);
    await db.close();

    let comments = [];
    try {
        const COMMENT_PATH = path.join(__dirname, "db", "comment.json");
        const data = await fs.readFile(COMMENT_PATH, "utf-8");
        const parsed = JSON.parse(data);
        const target = parsed.find(c => c.movie_id === movieId);
        if (target && Array.isArray(target.review)) {
            comments = target.review;  
        }
    } catch (err) {
        console.error("댓글 읽기 실패:", err);
    }

    if (movie) {
        const moviesHTML = renderMoives(movie, comments);
        res.send(moviesHTML);
    } else {
        res.status(404).send("영화를 찾을 수 없습니다.");
    }
});

app.post("/movies/:movie_id", async (req, res) => {
    const movieId = Number(req.params.movie_id);
    const { review, title } = req.body;  // title은 새 영화일 경우 필요
    const COMMENT_PATH = path.join(__dirname, "db", "comment.json");

    if (!review || typeof review !== "string") {
        return res.status(400).json({ error: "리뷰 내용을 입력해주세요." });
    }

    try {
        const data = await fs.readFile(COMMENT_PATH, "utf-8");
        const comments = JSON.parse(data);

        const target = comments.find(c => c.movie_id === movieId);

        if (target) {
            target.review.push(review);
        } else {
            comments.push({
                movie_id: movieId,
                movie_title: title || "none",
                review: [review]
            });
        }

        await fs.writeFile(COMMENT_PATH, JSON.stringify(comments, null, 2), "utf-8");


        console.log("리뷰 저장 완료: ", review);
        res.redirect("/movies/" + movieId); 
    } catch (err) {
        console.error("리뷰 저장 실패:", err);
        res.redirect("/movies/" + movieId);
    }
});

function reverseSortValue(target, order){
    if (target === "movie_rate" && order === "DESC") return "RateDescending";
    if (target === "movie_rate" && order === "ASC") return "RateAscending";
    if (target === "movie_release_date" && order === "DESC") return "DateDescending";
    if (target === "movie_release_date" && order === "ASC") return "DateAscending";
    return "RateDescending"
}   

function renderIndex(movies, search, filter) {
    let = movieHTHML = '';
    movies.forEach(movie => {
        const movieDiv = `
            <div class="Movie" onclick="location.href='./movies/${movie.movie_id}'">
                <div class="MoviePosterContainer">
                    <img class="MoviePoster" src="${movie.movie_image}" alt="${movie.movie_title} Poster"/>
                    <div class="MovieOverview">${movie.movie_overview}</div>
                </div>
                <div class="MovieRate">⭐ ${movie.movie_rate}</div>
                <div class="MovieRelease">📅 ${movie.movie_release_date}</div>
                <div class="MovieTitle">${movie.movie_title}</div>
            </div>
        `;
        movieHTHML += movieDiv;
    });

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Movie Site</title>
            <link rel="stylesheet" type="text/css" href="main.css">
            <script>
                document.addEventListener('DOMContentLoaded', () => {
                    const searchForm = document.getElementById('SearchForm');
                    const searchValue = document.getElementById('Search');
                    const filterForm = document.getElementById('FilterForm');
                    const filterList = Array.from(document.querySelectorAll("input[name='Sort']")).filter(input => input.value === "${filter}");
                    if (filterList.length > 0) filterList[0].checked = true;


                    function applyFilters() {
                        const title = searchValue.value.toLowerCase();
                        const sortValue = filterForm.Sort.value;

                        const [target, order] = sortMovies(sortValue);

                        location.href = "/?title="+title+"&target="+target+"&order="+order;
                    }

                    // Get sort type
                    function sortMovies(sortValue) {
                        switch (sortValue) {
                            case 'RateDescending':
                                return ["movie_rate", "DESC"];
                            case 'RateAscending':
                                return ["movie_rate", "ASC"];
                            case 'DateDescending':
                                return ["movie_release_date", "DESC"];
                            case 'DateAscending':
                                return ["movie_release_date", "ASC"];
                            default:
                                return ["movie_rate", "DESC"];
                        }
                    }

                    // Form Events
                    searchForm.addEventListener('submit', (e) => {
                        e.preventDefault();
                        applyFilters();
                    });

                    filterForm.addEventListener('change', (e) => {
                        applyFilters();
                    });
                });
            </script>
        </head>
        <body id="Index">
            <div id="Head">
                <h1>인프밍 영화 정보 사이트입니다.</h1>
            </div>
            
            <nav id="NavigateBar">
                <button id="RedirectToLogin" class="RedirectButton" onclick="location.href='/login'">로그인</button>
                <button id="RedirectToSignup" class="RedirectButton" onclick="location.href='/signup'">회원가입</button>
                <button id="RedirectToMain" class="RedirectButton" onclick="location.href='/'">메인 페이지</button>
            </nav>

            <form id="SearchForm" method="get" action="">
                <input type="search" id="Search" name="Search" placeholder="제목을 입력하세요" value="${search}"/>
                <input type="submit"  id="SearchSubmit" value="검색"/>
            </form>

            <h2 class="MainTitle">Movies</h2>
            <div id="Main">
                
                <form id="FilterForm" method="get" action="">
                    <div class="FilterList">
                        <input type="radio" name="Sort" id="RateDescending" value="RateDescending" checked/>
                        <label class="FilterRateLabel" for="RateDescending">평점 내림차순</label>
                    </div>
                    <div class="FilterList">
                        <input type="radio" name="Sort" id="RateAscending" value="RateAscending"/>
                        <label class="FilterRateLabel"for="RateAscending">평점 오름차순</label>
                    </div>
                    <div class="FilterList">
                        <input type="radio" name="Sort" id="DateDescending" value="DateDescending"/>
                        <label class="FilterDateLabel"for="DateDescending">개봉 내림차순</label>
                    </div>
                    <div class="FilterList">
                        <input type="radio" name="Sort" id="DateAscending" value="DateAscending"/>
                        <label class="FilterDateLabel"for="DateAscending">개봉 오름차순</label>
                    </div>
                </form>

                <div id="Movies">
                    <div id="MovieList">
                        ${movieHTHML}
                    </div>
                </div>
            </div>
        </body>
        </html>
        `
}

function renderMoives(movie, comments) {
    let = commentsHTHML = '';
    comments.forEach(c => {
        const commentLi = `
            <li class="CommentList">${c}</li>
        `;
        commentsHTHML += commentLi;
    });

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Movie Site</title>
            <link rel="stylesheet" type="text/css" href="./../main.css">
        </head>
        <body id="MovieReview">
            <div id="Head">
                <h1>인프밍 영화 정보 사이트입니다.</h1>
            </div>
            
            <nav id="NavigateBar">
                <button id="RedirectToLogin" class="RedirectButton" onclick="location.href='/login'">로그인</button>
                <button id="RedirectToSignup" class="RedirectButton" onclick="location.href='/signup'">회원가입</button>
                <button id="RedirectToMain" class="RedirectButton" onclick="location.href='/'">메인 페이지</button>
            </nav>
            
            <div id="Main">
                <div id="Introduce">
                    <img id="MoviePoster" src="${movie.movie_image}" alt="${movie.movie_title} Poster"/>
                    <div id="Detail">
                        <p id="MovieId">영화 ID: ${movie.movie_id}</p>
                        <h3 id="MovieTitle">${movie.movie_title}</h3>
                        <p id="MovieDate">개봉일: ${movie.movie_release_date}</p>
                        <p id="MovieRate">평점: ${movie.movie_rate}</p>
                        <p id="MovieOverview">줄거리: ${movie.movie_overview}</p>
                    </div>
                </div>
                <form id="Review" action="/movies/${movie.movie_id}" method="post">
                    <input type="hidden" name="title" value="${movie.movie_title}" />
                    <div id="ReviewText">
                        <label id="ReviewTitle" for="ReviewWrite">감상평 남기기</label>
                        <textarea id="ReviewWrite" name="review" cols="100" rows="3" placeholder="감상평을 입력하세요"></textarea>
                    </div>
                    <input id="ReviewSubmit" type="submit">
                </form>
                <ul id="Comment">
                    <h2>감상평</h2>
                    ${commentsHTHML}
                </ul>
            </div>
        </body>
        </html>
    `
}

// 서버에 접속할 포트 설정
const PORT = process.env.PORT || 3000;

// 서버가 PORT에 연결되었을 때, 수행할 함수
app.listen(PORT, () => {
    console.log("서버가 실행되었습니다.");
    console.log(`서버주소: http://localhost:${PORT}`);
});