Write-Host "🔧 SQL Server TCP/IP Configuration Helper" -ForegroundColor Green
Write-Host ""

Write-Host "📋 Current SQL Server Status:" -ForegroundColor Yellow
$sqlService = Get-Service -Name "MSSQLSERVER" -ErrorAction SilentlyContinue
if ($sqlService) {
    Write-Host "✅ SQL Server (MSSQLSERVER) is $($sqlService.Status)" -ForegroundColor Green
}
else {
    Write-Host "❌ SQL Server (MSSQLSERVER) not found" -ForegroundColor Red
}

$browserService = Get-Service -Name "SQLBrowser" -ErrorAction SilentlyContinue
if ($browserService) {
    Write-Host "✅ SQL Server Browser is $($browserService.Status)" -ForegroundColor Green
}
else {
    Write-Host "❌ SQL Server Browser not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "🔧 To enable TCP/IP protocol, follow these steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open SQL Server Configuration Manager:" -ForegroundColor White
Write-Host "   - Press Win + R" -ForegroundColor Gray
Write-Host "   - Type: SQLServerManager13.msc (for SQL Server 2016)" -ForegroundColor Gray
Write-Host "   - Press Enter" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Enable TCP/IP Protocol:" -ForegroundColor White
Write-Host "   - Expand 'SQL Server Network Configuration'" -ForegroundColor Gray
Write-Host "   - Click 'Protocols for MSSQLSERVER'" -ForegroundColor Gray
Write-Host "   - Right-click 'TCP/IP' → 'Enable'" -ForegroundColor Gray
Write-Host "   - Right-click 'TCP/IP' → 'Properties'" -ForegroundColor Gray
Write-Host "   - Go to 'IP Addresses' tab" -ForegroundColor Gray
Write-Host "   - Find 'IPAll' section at the bottom" -ForegroundColor Gray
Write-Host "   - Set 'TCP Port' to 62721" -ForegroundColor Gray
Write-Host "   - Click 'OK'" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Restart SQL Server:" -ForegroundColor White
Write-Host "   - Open Services (services.msc)" -ForegroundColor Gray
Write-Host "   - Find 'SQL Server (MSSQLSERVER)'" -ForegroundColor Gray
Write-Host "   - Right-click → 'Restart'" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Test Connection:" -ForegroundColor White
Write-Host "   - Run: .\set-env.bat" -ForegroundColor Gray
Write-Host ""

Write-Host "🚀 Alternative: Use Default Port (1433)" -ForegroundColor Cyan
Write-Host "If you can't configure custom port, use default port:" -ForegroundColor Gray
Write-Host "   - Run: .\set-env-default.bat" -ForegroundColor Gray
Write-Host ""

Write-Host "📞 Need Help?" -ForegroundColor Yellow
Write-Host "If you're still having issues:" -ForegroundColor Gray
Write-Host "1. Check SQL Server error logs" -ForegroundColor Gray
Write-Host "2. Verify SQL Server is running" -ForegroundColor Gray
Write-Host "3. Try connecting with SQL Server Management Studio first" -ForegroundColor Gray
Write-Host "4. Check if antivirus is blocking connections" -ForegroundColor Gray 