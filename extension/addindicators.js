(function () {
    // if the githubactivityindicator_debug key is set to true in local storage, debugging of the extension
    // will be enabled
    let storeDebugEnabled = browser.storage.local.get('githubactivityindicator_debug');
    storeDebugEnabled.then((res) => {
        window.debugEnabled = res.githubactivityindicator_debug;
    });


    const defaultAccessToken = "1a508d88a2c45dc12c25b34b3385c216dbfe3073";
    const NOT_A_REPO = Symbol("NOT_A_REPO");

    console.log("The Github Indicator Extension was loaded and \
    will start augmenting links to github repositories on this page.")

    // the github_token can be set in the settings of the extension.
    let gettingItem = browser.storage.sync.get('github_token');
    gettingItem.then((res) => {
        accessToken = res.github_token;
        if (isTokenValid(maybetoken)) {
            augment_with_custom_token(accessToken);
        }
        else {
            augment_with_default_token();
        }
    }, (error) => {
        console.log("Can't find an access token in local storage, or can't access local storage.");
        augment_with_default_token();
    });

    function isTokenValid(maybetoken) {
        return (maybetoken !== null
            && maybetoken !== undefined
            && maybetoken !== 'Undefined'
            && maybetoken !== '')
    }

    function augment_with_default_token() {
        console.info("Querying github with the default access token. This may fail if too many " +
            "users are using this extension. You can set a custom github access token in the configuration " +
            "of the extension.", accessToken)

        accessToken = defaultAccessToken;
        augment_repos(accessToken);
    }

    function augment_with_custom_token(token) {
        console.info("Querying github with the access token that was set in the plugin configuration: ", token);
        augment_repos(token);
    }


    async function augment_repos(accessToken) {
        // gets the links found on th page
        let links = Array.from(document.getElementsByTagName("a")).map(x => x.href);

        // extract all github repo links from all links found on the page
        let repos = links.map(link => maybe_repo_link(link))
            .filter(mayberepo => mayberepo !== NOT_A_REPO)
            .filter(is_repository);
        repos = [...new Set(repos)];
        dlog('repos to augment:', repos);

        if (repos.length == 0) { return; }


        // use graphql to query for the last commits
        let query = graphql_for_repos(repos);
        dlog('grapql query', query);

        let response = await query_github(query, accessToken);
        dlog('response from github', response);

        let body = await response.json();
        dlog('response as json', body);

        let repoinfos = extract_from_graph(body);

        // augment all link elements
        repoinfos.forEach(x => extend_link(x));
    }

    function extend_link(repoinfo) {
        dlog("extending link for", repoinfo);

        const elem = document.createElement("span");
        elem.textContent = repoinfo.lastPushedDaysAgo;
        elem.style.backgroundColor = "#dfe6e9";
        elem.style.fontSize = "9px";
        elem.style.height = "10px";
        elem.style.marginLeft = "7px";

        selector = "a[href='https://github.com/" + repoinfo.repo + "']";

        let els = Array.from(document.querySelectorAll(selector));
        els.forEach(e => e.insertAdjacentElement("afterend", elem));
    }

    function extract_from_graph(resp) {
        return Object.entries(resp.data) // returns a list of arrays [[r1,{repository info}],[r2,{info}]]
            .filter(x => x[0] !== 'rateLimit') // rateLimit is in the same hierary as the repository information
            .filter(x => x[1] !== null) // filter repos where nothing gets returned
            .map(x => { return { repo: x[1].nameWithOwner, lastPushedDaysAgo: daysAgo(x[1].pushedAt) } });
    }



    function maybe_repo_link(href) {
        dlog('link on page: ', href);
        const re = /https:\/\/github.com\/([_a-zA-Z0-9\\-]*\/[_a-zA-Z0-9\\-]*)$/i;
        if ((m = re.exec(href)) !== null) {
            return m[1].trim();
        }
        return NOT_A_REPO;
    }

    function is_repository(mayberepo) {
        dlog(`maybegithub internal: `, mayberepo);
        const norepo = ['settings', 'site', 'features', 'new', 'organizations', 'topics', 'GoogleChrome', 'account'];
        return !norepo.some(element => mayberepo.startsWith(element + '/'));
    }

    function graphql_for_repos(repos) {
        let subquery = repos.reduce(graphql_fragment_for, "")
        return `
        query { 
            ${subquery}
            rateLimit {
              limit
              cost
              remaining
              resetAt
            }
          }
          
          fragment fields on Repository {
            nameWithOwner
            pushedAt
          }
        `
    }

    function graphql_fragment_for(akk, repository, idx) {
        const [owner, name] = repository.split('/');
        return akk + `r${idx}: repository(owner:"${owner}", name:"${name}") {
            ...fields
        },
        `
    }

    function query_github(query, accessToken) {
        const github = "https://api.github.com/graphql"
        return fetch(github, {
            method: 'POST',
            headers: {
                'Authorization': 'bearer ' + accessToken
            },
            body: JSON.stringify({ "query": query }),
        })
    }

    function extend_link(repoinfo) {
        dlog("extending link for", repoinfo);

        const elem = document.createElement("span");
        elem.textContent = repoinfo.lastPushedDaysAgo;
        elem.style.backgroundColor = "#dfe6e9";
        elem.style.fontSize = "9px";
        elem.style.height = "10px";
        elem.style.marginLeft = "7px";

        selector = "a[href='https://github.com/" + repoinfo.repo + "']";

        let els = Array.from(document.querySelectorAll(selector));
        els.forEach(e => e.insertAdjacentElement("afterend", elem));
    }

    function daysAgo(date) {
        let ms = Date.now() - new Date(date);
        let days = ms / 1000 / 60 / 60 / 24;
        return Math.round(days);
    }

    /*
    a debug function that only prints if the variable "debug_github_activity_extension" is true
    */
    function dlog(msg, object) {
        //console.log(msg, object);
        if (window.debugEnabled == true) {
            console.log(msg, object);
        }
    }
})();

