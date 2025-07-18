Write-Host "🔧 Enabling TCP/IP Protocol for SQL Server..." -ForegroundColor Green
Write-Host ""

# Check if SQL Server is running
$sqlService = Get-Service -Name "MSSQLSERVER" -ErrorAction SilentlyContinue
if ($sqlService) {
    Write-Host "✅ SQL Server (MSSQLSERVER) is $($sqlService.Status)" -ForegroundColor Green
}
else {
    Write-Host "❌ SQL Server (MSSQLSERVER) not found" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📋 Manual Steps Required:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Since we can't access SQL Server Configuration Manager programmatically," -ForegroundColor Cyan
Write-Host "please follow these manual steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open SQL Server Management Studio (SSMS)" -ForegroundColor White
Write-Host "2. Connect to your SQL Server instance" -ForegroundColor Gray
Write-Host "3. Run this SQL query to enable TCP/IP:" -ForegroundColor Gray
Write-Host ""
Write-Host "   EXEC xp_instance_regwrite" -ForegroundColor Gray
Write-Host "       N'HKEY_LOCAL_MACHINE'," -ForegroundColor Gray
Write-Host "       N'Software\Microsoft\MSSQLServer\MSSQLServer\SuperSocketNetLib\Tcp\IPAll'," -ForegroundColor Gray
Write-Host "       N'TcpPort'," -ForegroundColor Gray
Write-Host "       N'REG_SZ'," -ForegroundColor Gray
Write-Host "       N'62721'" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Restart SQL Server service" -ForegroundColor White
Write-Host "   - Open Services (services.msc)" -ForegroundColor Gray
Write-Host "   - Find 'SQL Server (MSSQLSERVER)'" -ForegroundColor Gray
Write-Host "   - Right-click → 'Restart'" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Test the connection:" -ForegroundColor White
Write-Host "   - Run: .\set-env.bat" -ForegroundColor Gray
Write-Host ""

Write-Host "🚀 Alternative: Use Default Port" -ForegroundColor Cyan
Write-Host "If you can't configure custom port, use default port:" -ForegroundColor Gray
Write-Host "   - Run: .\set-env-default.bat" -ForegroundColor Gray
Write-Host ""

Write-Host "📞 Need Help?" -ForegroundColor Yellow
Write-Host "If you're still having issues:" -ForegroundColor Gray
Write-Host "1. Check SQL Server error logs" -ForegroundColor Gray
Write-Host "2. Verify SQL Server is running" -ForegroundColor Gray
Write-Host "3. Try connecting with SQL Server Management Studio first" -ForegroundColor Gray
Write-Host "4. Check if antivirus is blocking connections" -ForegroundColor Gray 