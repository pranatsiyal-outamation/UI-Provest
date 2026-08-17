CREATE OR ALTER PROCEDURE [dbo].[usp_ProVestAdmin_Client_GetById]
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        c.Id,
        c.ClientName,
        c.ClientCode,
        c.InboundFolder,
        c.OutboundFolder,
        c.IsMergingEnabled,
        c.IsActive,
        c.StateColumn,
        c.UniqueColumns,
        c.IsZipExtractionEnabled,
        c.FileNumberColumn,
        c.ProjectSetupId
    FROM dbo.ProVestClient c
    WHERE c.Id = @Id;
END
