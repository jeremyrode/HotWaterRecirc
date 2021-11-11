%Analyse the DemandLog

PosixTimeData = readmatrix('V:\DemandLogRecirc.txt','Delimiter',',');

DataTimeData = datetime(PosixTimeData,'ConvertFrom','posixtime');

histogram(DataTimeData.Hour)
