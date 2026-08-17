CREATE OR ALTER PROCEDURE [dbo].[usp_ProVestAdmin_ClientLocation_GetById]
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        l.Id,
        l.ProVestClientId,
        c.ClientName,
        l.LocationId,
        l.State,
        l.IsActive,
        l.ProjectSetupId
    FROM dbo.ProVestClientLocation l
    INNER JOIN dbo.ProVestClient c ON c.Id = l.ProVestClientId
    WHERE l.Id = @Id;
END
