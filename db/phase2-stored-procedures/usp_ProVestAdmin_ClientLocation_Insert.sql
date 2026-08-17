CREATE OR ALTER PROCEDURE [dbo].[usp_ProVestAdmin_ClientLocation_Insert]
    @ProVestClientId INT,
    @LocationId      INT,
    @State           VARCHAR(30),
    @IsActive        BIT = 1,
    @ProjectSetupId  INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        INSERT INTO dbo.ProVestClientLocation
            (ProVestClientId, LocationId, State, IsActive, ProjectSetupId)
        VALUES
            (@ProVestClientId, @LocationId, @State, @IsActive, @ProjectSetupId);

        DECLARE @NewId INT = CAST(SCOPE_IDENTITY() AS INT);

        COMMIT TRANSACTION;

        SELECT @NewId AS Id;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
