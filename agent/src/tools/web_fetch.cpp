#include "simi/tools.hpp"
#include <sstream>
#include <regex>

#ifdef _WIN32
#include <windows.h>
#include <winhttp.h>
#pragma comment(lib, "winhttp.lib")
#else
#include <curl/curl.h>
#endif

namespace simi {

// ============================================================================
// WebFetchTool
// ============================================================================

ToolSchema WebFetchTool::get_schema() const {
    return {
        "web_fetch",
        "Fetch content from a URL. Returns the response body.",
        {
            {"url", "string", "The URL to fetch", true, std::nullopt},
            {"method", "string", "HTTP method (GET, POST)", false, "GET"},
            {"headers", "string", "Custom headers (key:value,key:value)", false, std::nullopt}
        }
    };
}

bool WebFetchTool::is_available() const {
    return true;  // Always available on supported platforms
}

#ifdef _WIN32
// Windows WinHTTP implementation
ToolResult WebFetchTool::execute(const std::map<std::string, std::string>& args) {
    auto url_it = args.find("url");
    if (url_it == args.end()) {
        return {"", false, "", "url is required"};
    }

    std::string url = url_it->second;
    std::string method = args.count("method") ? args.at("method") : "GET";

    // Parse URL
    std::wstring wurl(url.begin(), url.end());
    URL_COMPONENTS urlComp = {0};
    urlComp.dwStructSize = sizeof(urlComp);

    wchar_t hostName[256] = {0};
    wchar_t urlPath[2048] = {0};

    urlComp.lpszHostName = hostName;
    urlComp.dwHostNameLength = sizeof(hostName) / sizeof(wchar_t);
    urlComp.lpszUrlPath = urlPath;
    urlComp.dwUrlPathLength = sizeof(urlPath) / sizeof(wchar_t);

    if (!WinHttpCrackUrl(wurl.c_str(), 0, 0, &urlComp)) {
        return {"", false, "", "Invalid URL"};
    }

    bool isHttps = (urlComp.nScheme == INTERNET_SCHEME_HTTPS);

    // Open session
    HINTERNET hSession = WinHttpOpen(
        L"Simi-Agent/1.0",
        WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,
        WINHTTP_NO_PROXY_NAME,
        WINHTTP_NO_PROXY_BYPASS,
        0
    );

    if (!hSession) {
        return {"", false, "", "Failed to open HTTP session"};
    }

    // Connect
    HINTERNET hConnect = WinHttpConnect(
        hSession,
        hostName,
        urlComp.nPort,
        0
    );

    if (!hConnect) {
        WinHttpCloseHandle(hSession);
        return {"", false, "", "Failed to connect"};
    }

    // Create request
    std::wstring wmethod(method.begin(), method.end());
    HINTERNET hRequest = WinHttpOpenRequest(
        hConnect,
        wmethod.c_str(),
        urlPath,
        NULL,
        WINHTTP_NO_REFERER,
        WINHTTP_DEFAULT_ACCEPT_TYPES,
        isHttps ? WINHTTP_FLAG_SECURE : 0
    );

    if (!hRequest) {
        WinHttpCloseHandle(hConnect);
        WinHttpCloseHandle(hSession);
        return {"", false, "", "Failed to create request"};
    }

    // Set timeout
    WinHttpSetTimeouts(hRequest, timeout_ms, timeout_ms, timeout_ms, timeout_ms);

    // Send request
    if (!WinHttpSendRequest(hRequest, WINHTTP_NO_ADDITIONAL_HEADERS, 0,
                            WINHTTP_NO_REQUEST_DATA, 0, 0, 0)) {
        WinHttpCloseHandle(hRequest);
        WinHttpCloseHandle(hConnect);
        WinHttpCloseHandle(hSession);
        return {"", false, "", "Failed to send request"};
    }

    // Receive response
    if (!WinHttpReceiveResponse(hRequest, NULL)) {
        WinHttpCloseHandle(hRequest);
        WinHttpCloseHandle(hConnect);
        WinHttpCloseHandle(hSession);
        return {"", false, "", "Failed to receive response"};
    }

    // Get status code
    DWORD statusCode = 0;
    DWORD size = sizeof(statusCode);
    WinHttpQueryHeaders(hRequest,
        WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
        WINHTTP_HEADER_NAME_BY_INDEX,
        &statusCode, &size, WINHTTP_NO_HEADER_INDEX);

    // Read response body
    std::ostringstream response;
    DWORD bytesRead = 0;
    size_t totalRead = 0;
    char buffer[8192];

    while (WinHttpReadData(hRequest, buffer, sizeof(buffer), &bytesRead) && bytesRead > 0) {
        response.write(buffer, bytesRead);
        totalRead += bytesRead;
        if (totalRead > max_response_size) {
            response << "\n... (response truncated)";
            break;
        }
    }

    // Cleanup
    WinHttpCloseHandle(hRequest);
    WinHttpCloseHandle(hConnect);
    WinHttpCloseHandle(hSession);

    bool success = (statusCode >= 200 && statusCode < 300);
    std::string result = response.str();

    if (!success) {
        return {"", false, result, "HTTP " + std::to_string(statusCode)};
    }

    return {"", true, result, std::nullopt};
}

#else
// Unix libcurl implementation
static size_t WriteCallback(void* contents, size_t size, size_t nmemb, void* userp) {
    size_t totalSize = size * nmemb;
    std::string* str = static_cast<std::string*>(userp);
    str->append(static_cast<char*>(contents), totalSize);
    return totalSize;
}

ToolResult WebFetchTool::execute(const std::map<std::string, std::string>& args) {
    auto url_it = args.find("url");
    if (url_it == args.end()) {
        return {"", false, "", "url is required"};
    }

    std::string url = url_it->second;
    std::string method = args.count("method") ? args.at("method") : "GET";

    CURL* curl = curl_easy_init();
    if (!curl) {
        return {"", false, "", "Failed to initialize curl"};
    }

    std::string response;

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT_MS, timeout_ms);
    curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
    curl_easy_setopt(curl, CURLOPT_USERAGENT, user_agent.c_str());
    curl_easy_setopt(curl, CURLOPT_MAXFILESIZE, max_response_size);

    CURLcode res = curl_easy_perform(curl);

    long http_code = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);

    curl_easy_cleanup(curl);

    if (res != CURLE_OK) {
        return {"", false, "", "Curl error: " + std::string(curl_easy_strerror(res))};
    }

    bool success = (http_code >= 200 && http_code < 300);
    if (!success) {
        return {"", false, response, "HTTP " + std::to_string(http_code)};
    }

    return {"", true, response, std::nullopt};
}
#endif

// ============================================================================
// WebSearchTool
// ============================================================================

ToolSchema WebSearchTool::get_schema() const {
    return {
        "web_search",
        "Search the web for information.",
        {
            {"query", "string", "Search query", true, std::nullopt},
            {"max_results", "integer", "Maximum number of results", false, "10"}
        }
    };
}

bool WebSearchTool::is_available() const {
    // Would need API key or external service
    return false;  // Disabled by default
}

ToolResult WebSearchTool::execute(const std::map<std::string, std::string>& args) {
    return {"", false, "", "Web search requires API configuration"};
}

} // namespace simi
