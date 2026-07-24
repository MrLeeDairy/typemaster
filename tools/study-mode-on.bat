@echo off
rem 开启学习模式：封锁浏览器上网（本地练习不受影响），全屏打开练习页
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0study-mode-on.ps1\"'"
