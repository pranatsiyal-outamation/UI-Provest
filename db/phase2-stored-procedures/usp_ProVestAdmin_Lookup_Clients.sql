-- FK picker source for ProVestClientLocation.ProVestClientId.
-- Inactive clients are returned too, so an existing location that points at a
-- deactivated client still renders its name instead of a bare id.
CREATE OR ALTER PROCEDURE [dbo].[usp_ProVestAdmin_Lookup_Clients]
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        c.Id,
        c.ClientName,
        c.ClientCode,
        c.IsActive
    FROM dbo.ProVestClient c
    ORDER BY c.ClientName, c.Id;
END
